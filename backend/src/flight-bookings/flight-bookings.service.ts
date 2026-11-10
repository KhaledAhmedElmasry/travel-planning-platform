import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import {
  Connection,
  FilterQuery,
  isValidObjectId,
  Model,
  Types,
} from 'mongoose';
import { AirlinesService } from '../airlines/airlines.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BookingStatus, BookingType } from '../common/enums';
import { allowedFrom } from '../payments/booking-lifecycle';
import type {
  BookingPaymentHandler,
  BookingPolicies,
  ConfirmPaidBookingResult,
  PayableBooking,
} from '../payments/interfaces/payable-booking.interface';
import {
  newReference,
  REFERENCE_ATTEMPTS,
} from '../payments/booking-reference';
import { isDuplicateKeyError } from '../payments/is-duplicate-key-error';
import { platformCurrency } from '../payments/platform-currency';
import { flightConfirmedText } from './booking-notifications';
import { FlightBookingQuoteService } from './booking-quote.service';
import { FlightBookingRequestDto } from './dto/hold-flight-booking.dto';
import {
  FlightBookingGroup,
  ListFlightBookingsQueryDto,
} from './dto/list-flight-bookings-query.dto';
import { localTime, renderETicket } from './e-ticket';
import {
  FlightBooking,
  FlightBookingDocument,
} from './schemas/flight-booking.schema';
import { FlightSeatSelectionService } from './flight-seat-selection.service';
import { SeatInventoryService } from './seat-inventory.service';
import {
  DEFAULT_PAGE_SIZE,
  getPaginationOffset,
  PaginatedList,
  paginate,
} from '../common/dto';

// Area: Payments, Holds & Booking Engine (FLT-22, FLT-23) and Search & My Bookings (FLT-19,
// FLT-21, FLT-25)
// Business logic and database access for: FLT-19, FLT-21, FLT-22, FLT-23, FLT-25, FLT-26, GEN-11
//
// Done here (Area 1): the seat hold (FLT-22), the four BookingPaymentHandler methods used by the
// payments module (PAY-01, PAY-02), confirmation with the booking reference and the e-ticket
// (FLT-23). The hold-expiry job and cancellation are in flight-booking-lifecycle.service.ts.
// WAITING FOR: FlightBookingQuoteService.quote() (Area 6) and AirlinesService.getBookingPolicies()
// (Area 5); until then the hold and the policies answer 501.
// GEN-01: the user is notified on confirmation (see tryConfirm).
// TODO(FLT-19, FLT-21, FLT-25; Area 6): the summary, the list and the details go here too. The
// details must include RefundsService.findRefundForBooking() and the refund preview (FLT-26):
// FlightBookingLifecycleService.previewCancellation(booking), the same function the cancellation
// uses. For the Upcoming group of the list use upcomingFlightBookings() below (GEN-11).

// FLT-22: seats are held for 10 minutes.
export const HOLD_MINUTES = 10;

// GEN-11 "upcoming" (ACC-12, Area 2; the Upcoming group of FLT-25, Area 6): Confirmed, with a
// flight not yet departed. A round trip whose outbound flight has flown is still upcoming (its
// return flight is ahead); it becomes Completed when its last flight departs (completeDeparted).
export function upcomingFlightBookings(
  now = new Date(),
): FilterQuery<FlightBooking> {
  return {
    status: BookingStatus.Confirmed,
    $expr: { $gt: [{ $max: '$segments.departureAt' }, now] },
  };
}

export interface FlightBookingResponse {
  id: string;
  reference: string | null;
  status: BookingStatus;
  holdExpiresAt: Date | null;
  segments: {
    flightId: string;
    flightNumber: string;
    airlineName: string;
    cabinClass: string;
    departureAirport: string;
    arrivalAirport: string;
    departureAt: Date;
    arrivalAt: Date;
    // Local time at each airport (GEN-06).
    departureLocal: string;
    arrivalLocal: string;
    fare: number;
    freeBags: number;
    maxBagWeightKg: number;
  }[];
  passengers: {
    type: string;
    fullName: string;
    dateOfBirth: string;
    passportNumber: string;
    extraBags: { weightKg: number }[];
    fare: number;
    baggageFee: number;
  }[];
  seats: number;
  totalAmount: number;
  currency: string;
  policiesAcceptedAt: Date | null;
  paymentId: string | null;
  confirmedAt: Date | null;
  expiredAt: Date | null;
  cancelledAt: Date | null;
  completedAt: Date | null;
  createdAt?: Date;
}

export interface FlightBookingListItem {
  id: string;
  reference: string | null;
  status: BookingStatus;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureAt: Date;
  departureLocal: string;
  passengers: number;
  cabinClass: string;
}

@Injectable()
export class FlightBookingsService implements BookingPaymentHandler {
  private readonly logger = new Logger(FlightBookingsService.name);

  constructor(
    @InjectModel(FlightBooking.name)
    private readonly bookingModel: Model<FlightBooking>,
    @InjectConnection() private readonly connection: Connection,
    private readonly seats: SeatInventoryService,
    private readonly quotes: FlightBookingQuoteService,
    private readonly airlines: AirlinesService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly seatSelection: FlightSeatSelectionService,
  ) {}

  // POST /api/flight-bookings/hold (FLT-22): reserve the seats on every segment and create the
  // booking in ONE transaction, so either everything happens or nothing does. Concurrent holds on
  // the last seats: MongoDB lets only one update win; the other gets 409.
  async hold(
    userId: string,
    request: FlightBookingRequestDto,
  ): Promise<FlightBookingResponse> {
    // Validates the passengers and computes the prices (FLT-19, FLT-12; Area 6).
    const quote = await this.quotes.quote(request);
    if (quote.currency !== platformCurrency(this.config)) {
      // Should never happen: every price is in the platform currency (PAY-04).
      throw new ConflictException(
        'The booking is not priced in the platform currency.',
      );
    }

    const created: { booking: FlightBookingDocument | null } = {
      booking: null,
    };
    await this.connection.transaction(async (session) => {
      for (const segment of quote.segments) {
        const held = await this.seats.hold(
          segment.flightId,
          segment.cabinClass,
          quote.seats,
          session,
        );
        if (!held) {
          // Aborts the transaction: seats already held on the other segment are given back.
          throw new ConflictException(
            `Not enough seats left in ${segment.cabinClass} on flight ${segment.flightNumber}, or the flight can no longer be booked.`,
          );
        }
      }
      const [booking] = await this.bookingModel.create(
        [
          {
            userId,
            status: BookingStatus.PendingPayment,
            segments: quote.segments,
            passengers: quote.passengers,
            seats: quote.seats,
            totalAmount: quote.totalAmount,
            currency: quote.currency,
            holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60 * 1000),
          },
        ],
        { session },
      );
      created.booking = booking;
    });
    if (!created.booking) throw new Error('The booking was not created.');
    return this.toResponse(created.booking);
  }

  quote(request: FlightBookingRequestDto) {
    return this.quotes.quote(request);
  }

  // GET /api/flight-bookings/:id/e-ticket (FLT-23): only the owner, only a Confirmed booking.
  async eTicket(
    userId: string,
    bookingId: string,
  ): Promise<{ pdf: Buffer; reference: string }> {
    const booking = await this.findOwned(userId, bookingId);
    if (booking.status !== BookingStatus.Confirmed || !booking.reference) {
      throw new ConflictException(
        `This booking is ${booking.status}; the e-ticket is only available for a confirmed booking.`,
      );
    }
    const pdf = await renderETicket({
      reference: booking.reference,
      segments: booking.segments,
      passengers: booking.passengers,
      totalAmount: booking.totalAmount,
      currency: booking.currency,
      // FLT-28: the seats the passengers chose, if any.
      seats: await this.seatSelection.list(booking),
    });
    return { pdf, reference: booking.reference };
  }

  // The owner's booking, otherwise 404 (ACC-11).
  async findOwned(
    userId: string,
    bookingId: string,
  ): Promise<FlightBookingDocument> {
    const booking = isValidObjectId(bookingId)
      ? await this.bookingModel.findOne({ _id: bookingId, userId })
      : null;
    if (!booking) throw new NotFoundException('Booking not found.');
    return booking;
  }

  // ACC-12 (Area 2): deactivating an account is blocked while the user has an upcoming flight
  // booking (GEN-11, see upcomingFlightBookings()).
  async hasUpcomingBookings(
    userId: string,
    now = new Date(),
  ): Promise<boolean> {
    if (!isValidObjectId(userId)) return false;
    const found = await this.bookingModel.exists({
      userId,
      ...upcomingFlightBookings(now),
    });
    return found !== null;
  }

  // FLT-25: list only the current user's bookings in the requested lifecycle group.
  async listOwn(
    userId: string,
    query: ListFlightBookingsQueryDto,
  ): Promise<PaginatedList<FlightBookingListItem>> {
    const filter: FilterQuery<FlightBooking> = { userId };
    switch (query.group) {
      case FlightBookingGroup.Upcoming:
        Object.assign(filter, upcomingFlightBookings());
        break;
      case FlightBookingGroup.Past:
        filter.status = {
          $in: [BookingStatus.Completed, BookingStatus.Expired],
        };
        break;
      case FlightBookingGroup.Cancelled:
        filter.status = BookingStatus.Cancelled;
        break;
    }

    const page = query.page ?? 1;
    const { skip, limit } = getPaginationOffset(page, DEFAULT_PAGE_SIZE);
    const [bookings, total] = await Promise.all([
      this.bookingModel
        .find(filter)
        .sort({ 'segments.departureAt': 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.bookingModel.countDocuments(filter).exec(),
    ]);

    return paginate(
      bookings.map((booking) => this.toListItem(booking)),
      total,
      page,
      DEFAULT_PAGE_SIZE,
    );
  }

  private toListItem(booking: FlightBookingDocument): FlightBookingListItem {
    const segment = booking.segments[0];
    return {
      id: booking._id.toString(),
      reference: booking.reference ?? null,
      status: booking.status,
      flightNumber: segment.flightNumber,
      departureAirport: segment.departureAirport.code,
      arrivalAirport: segment.arrivalAirport.code,
      departureAt: segment.departureAt,
      departureLocal: localTime(
        segment.departureAt,
        segment.departureAirport.timeZone,
      ),
      passengers: booking.passengers.length,
      cabinClass: segment.cabinClass,
    };
  }

  // --- Used by the payments module (PAY-01, PAY-02) ---

  async findPayableBooking(bookingId: string): Promise<PayableBooking | null> {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) return null;
    return {
      id: booking._id.toString(),
      userId: booking.userId.toString(),
      status: booking.status,
      totalAmount: booking.totalAmount,
      currency: booking.currency,
      holdExpiresAt: booking.holdExpiresAt,
      policiesAcceptedAt: booking.policiesAcceptedAt,
    };
  }

  // PAY-02: one atomic update, so a hold that expires at the same moment cannot be accepted.
  async recordPolicyAcceptance(
    bookingId: string,
    acceptedAt: Date,
  ): Promise<boolean> {
    const result = await this.bookingModel.updateOne(
      {
        _id: bookingId,
        status: BookingStatus.PendingPayment,
        holdExpiresAt: { $gt: acceptedAt },
        policiesAcceptedAt: null,
      },
      { $set: { policiesAcceptedAt: acceptedAt } },
    );
    return result.modifiedCount === 1;
  }

  // PAY-02: the airline's tiers and baggage rules (Area 5) plus the booked cabins' free baggage.
  // Round trips use the outbound airline, as for cancellations (FLT-12).
  async getBookingPolicies(bookingId: string): Promise<BookingPolicies | null> {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) return null;
    const airline = await this.airlines.getBookingPolicies(
      booking.segments[0].airlineId.toString(),
    );
    if (!airline) return null;
    return {
      bookingType: BookingType.Flight,
      airline: { id: airline.airlineId, name: airline.name },
      cancellationTiers: [...airline.cancellationTiers].sort(
        (a, b) => b.daysBefore - a.daysBefore,
      ),
      baggage: {
        cabins: booking.segments.map((s) => ({
          flightId: s.flightId.toString(),
          flightNumber: s.flightNumber,
          cabinClass: s.cabinClass,
          freeBags: s.freeBags,
          maxBagWeightKg: s.maxBagWeightKg,
        })),
        extraBagPrice: airline.extraBagPrice,
        maxExtraBagsPerPassenger: airline.maxExtraBagsPerPassenger,
      },
    };
  }

  // FLT-23, called only by the verified Stripe webhook. In one transaction: pending_payment ->
  // confirmed with a unique reference, and held seats -> booked seats. A hold that has expired can
  // never be confirmed (GEN-11): the payment is then refunded by PaymentsService.
  async confirmPaidBooking(
    bookingId: string,
    paymentId: string,
  ): Promise<ConfirmPaidBookingResult> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.tryConfirm(bookingId, paymentId);
      } catch (err) {
        // Another booking already has this reference (very rare): try a new one.
        if (isDuplicateKeyError(err) && attempt < REFERENCE_ATTEMPTS) continue;
        throw err;
      }
    }
  }

  private async tryConfirm(
    bookingId: string,
    paymentId: string,
  ): Promise<ConfirmPaidBookingResult> {
    const outcome: {
      result: ConfirmPaidBookingResult;
      booking: FlightBookingDocument | null;
    } = { result: 'not_confirmable', booking: null };
    await this.connection.transaction(async (session) => {
      const now = new Date();
      const booking = await this.bookingModel.findOneAndUpdate(
        {
          _id: bookingId,
          status: { $in: allowedFrom(BookingStatus.Confirmed) },
          holdExpiresAt: { $gt: now },
        },
        {
          $set: {
            status: BookingStatus.Confirmed,
            confirmedAt: now,
            paymentId: new Types.ObjectId(paymentId),
            reference: newReference(),
          },
        },
        { new: true, session },
      );

      if (!booking) {
        // Stripe can send the same event twice. If THIS payment already confirmed the booking, the
        // event is a duplicate: nothing to do, even if the booking has moved on since (completed or
        // cancelled, GEN-11). Refunding here would give back the money of a used trip.
        const current = await this.bookingModel
          .findById(bookingId)
          .session(session);
        outcome.result =
          current?.paymentId?.toString() === paymentId
            ? 'already_confirmed'
            : 'not_confirmable';
        return;
      }

      for (const segment of booking.segments) {
        const moved = await this.seats.convertHeldToBooked(
          segment.flightId.toString(),
          segment.cabinClass,
          booking.seats,
          session,
        );
        if (!moved) {
          throw new Error(
            `Held seats of booking ${bookingId} not found on flight ${segment.flightNumber}.`,
          );
        }
      }
      outcome.result = 'confirmed';
      outcome.booking = booking;
    });

    if (outcome.result === 'confirmed' && outcome.booking) {
      this.logger.log(`Flight booking ${bookingId} confirmed.`);
      // FLT-23, GEN-01: after the commit, so the user is never told about a confirmation that was
      // rolled back. Only the request that confirmed the booking gets here, so it is sent once.
      const { title, message } = flightConfirmedText(outcome.booking);
      await this.notifications.notify(outcome.booking.userId, title, message);
    }
    return outcome.result;
  }

  toResponse(booking: FlightBookingDocument): FlightBookingResponse {
    return {
      id: booking._id.toString(),
      reference: booking.reference ?? null,
      status: booking.status,
      holdExpiresAt:
        booking.status === BookingStatus.PendingPayment
          ? booking.holdExpiresAt
          : null,
      segments: booking.segments.map((s) => ({
        flightId: s.flightId.toString(),
        flightNumber: s.flightNumber,
        airlineName: s.airlineName,
        cabinClass: s.cabinClass,
        departureAirport: s.departureAirport.code,
        arrivalAirport: s.arrivalAirport.code,
        departureAt: s.departureAt,
        arrivalAt: s.arrivalAt,
        departureLocal: localTime(s.departureAt, s.departureAirport.timeZone),
        arrivalLocal: localTime(s.arrivalAt, s.arrivalAirport.timeZone),
        fare: s.fare,
        freeBags: s.freeBags,
        maxBagWeightKg: s.maxBagWeightKg,
      })),
      passengers: booking.passengers.map((p) => ({
        type: p.type,
        fullName: p.fullName,
        dateOfBirth: p.dateOfBirth,
        passportNumber: p.passportNumber,
        extraBags: p.extraBags.map((b) => ({ weightKg: b.weightKg })),
        fare: p.fare,
        baggageFee: p.baggageFee,
      })),
      seats: booking.seats,
      totalAmount: booking.totalAmount,
      currency: booking.currency,
      policiesAcceptedAt: booking.policiesAcceptedAt,
      paymentId: booking.paymentId?.toString() ?? null,
      confirmedAt: booking.confirmedAt,
      expiredAt: booking.expiredAt,
      cancelledAt: booking.cancelledAt,
      completedAt: booking.completedAt,
      createdAt: booking.createdAt,
    };
  }
}
