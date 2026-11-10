import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Airline } from '../airlines/schemas/airline.schema';
import { BookingStatus, BookingType, PassengerType } from '../common/enums';
import { Flight, FlightStatus } from '../flights/schemas/flight.schema';
import { calculatePassengerPricing } from '../flights/utils/passenger-pricing';
import { NotificationsService } from '../notifications/notifications.service';
import { FareChangeService } from '../payments/fare-change.service';
import { formatMoney } from '../payments/format-money';
import { PaymentStatus } from '../payments/schemas/payment.schema';
import { ageOnDate, matchesPassengerType } from './booking-quote.service';
import { ChangeFlightDto } from './dto/change-flight.dto';
import { localTime } from './e-ticket';
import {
  FlightBookingResponse,
  FlightBookingsService,
} from './flight-bookings.service';
import { FlightSeatSelectionService } from './flight-seat-selection.service';
import {
  BookedPassenger,
  BookedSegment,
  FlightBooking,
  FlightBookingDocument,
} from './schemas/flight-booking.schema';
import { SeatInventoryService } from './seat-inventory.service';

// Area: Payments, Holds & Booking Engine
// FLT-27 (bonus): change the flight of one segment of a Confirmed booking to another flight on
// the same route and in the same cabin, subject to seat availability. A higher fare is paid
// through Stripe, a lower fare is refunded (see FareChangeService for how the money moves).
//
// Order of work, so nothing can be lost:
//   1. check everything and price the change (nothing is written);
//   2. a higher fare is charged on a new PaymentIntent, and the refund of that charge (kind
//      'compensation') is written down at once;
//   3. ONE database transaction: the new flight's seats are taken, the old flight's seats are
//      released, the booking's segment, fares and total are replaced (only if the booking is
//      still Confirmed and still on the old flight), the payment record is brought in line with
//      the new total, and the refunds owed (old PaymentIntent, or the fare difference) are
//      written down. If it fails, the compensation refund gives the charge back;
//   4. after the commit the owed refunds are sent to Stripe (a failed one is retried every
//      minute), the passenger's seat picks on that flight are cleared and the user is notified.
// Extra baggage that was already paid keeps its price (the old airline's price per bag is not
// stored per flight); the bags must still be allowed on the new flight.

export interface FareChangeSummary {
  direction: 'charged' | 'refunded' | 'none';
  // The fare difference in cents (always >= 0) and the new total of the booking.
  amount: number;
  previousTotal: number;
  newTotal: number;
  currency: string;
}

export type ChangedFlightBookingResponse = FlightBookingResponse & {
  fareChange: FareChangeSummary;
};

const NO_SEATS =
  'The booking is not Confirmed, or the new flight has no seats left in that cabin.';

@Injectable()
export class FlightBookingChangeService {
  private readonly logger = new Logger(FlightBookingChangeService.name);

  constructor(
    @InjectModel(FlightBooking.name)
    private readonly bookingModel: Model<FlightBooking>,
    @InjectModel(Flight.name) private readonly flightModel: Model<Flight>,
    @InjectModel(Airline.name) private readonly airlineModel: Model<Airline>,
    @InjectConnection() private readonly connection: Connection,
    private readonly bookings: FlightBookingsService,
    private readonly seats: SeatInventoryService,
    private readonly seatSelection: FlightSeatSelectionService,
    private readonly fareChange: FareChangeService,
    private readonly notifications: NotificationsService,
  ) {}

  async changeFlight(
    userId: string,
    bookingId: string,
    dto: ChangeFlightDto,
    now = new Date(),
  ): Promise<ChangedFlightBookingResponse> {
    const booking = await this.bookings.findOwned(userId, bookingId);
    if (booking.status !== BookingStatus.Confirmed) {
      throw new ConflictException(NO_SEATS);
    }
    const index = dto.segment === 'return' ? 1 : 0;
    const old = booking.segments[index];
    if (!old)
      throw new BadRequestException('This booking has no return flight.');
    if (old.departureAt.getTime() <= now.getTime()) {
      throw new ConflictException('This flight has already departed.');
    }
    if (old.flightId.toString() === dto.newFlightId) {
      throw new BadRequestException('The booking is already on this flight.');
    }

    // --- 1. check and price ---
    const flight = await this.flightModel
      .findById(dto.newFlightId)
      .lean<Flight & { _id: Types.ObjectId }>()
      .exec();
    if (!flight) throw new NotFoundException('Booking or flight not found.');
    if (flight.status !== FlightStatus.Scheduled || flight.departureAt <= now) {
      throw new ConflictException(
        'The new flight is not scheduled, or it has already departed.',
      );
    }
    const airline = await this.airlineModel
      .findById(flight.airlineId)
      .lean<Airline & { _id: Types.ObjectId }>()
      .exec();
    if (!airline || airline.active === false) {
      throw new ConflictException(
        'The airline of the new flight is not available.',
      );
    }
    if (
      flight.departureAirport !== old.departureAirport.code ||
      flight.arrivalAirport !== old.arrivalAirport.code
    ) {
      throw new BadRequestException('The new flight is not on the same route.');
    }
    const cabin = flight.cabins.find((c) => c.cabinClass === old.cabinClass);
    if (!cabin || cabin.total - cabin.booked - cabin.held < booking.seats) {
      throw new ConflictException(NO_SEATS);
    }

    const other = booking.segments[index === 0 ? 1 : 0];
    if (other) {
      const outboundArrival = index === 0 ? flight.arrivalAt : other.arrivalAt;
      const returnDeparture =
        index === 0 ? other.departureAt : flight.departureAt;
      if (returnDeparture <= outboundArrival) {
        throw new BadRequestException(
          'The return flight must depart after the outbound flight arrives.',
        );
      }
    }
    if (index === 0) {
      for (const passenger of booking.passengers) {
        const age = ageOnDate(passenger.dateOfBirth, flight.departureDate);
        if (!matchesPassengerType(passenger.type, age)) {
          throw new BadRequestException(
            `Passenger type ${passenger.type} does not match the age of ${passenger.fullName} on the new departure date.`,
          );
        }
      }
    }
    for (const passenger of booking.passengers) {
      const bags = passenger.extraBags ?? [];
      if (bags.length === 0) continue;
      if (bags.length > (airline.maxExtraBagsPerPassenger ?? 0)) {
        throw new BadRequestException(
          `A passenger may have at most ${airline.maxExtraBagsPerPassenger ?? 0} extra bag(s) on flight ${flight.flightNumber}.`,
        );
      }
      if (bags.some((bag) => bag.weightKg > cabin.maxBagWeightKg)) {
        throw new BadRequestException(
          `An extra bag exceeds the maximum weight of ${cabin.maxBagWeightKg} kg on flight ${flight.flightNumber}.`,
        );
      }
      if (airline.extraBagPrice == null) {
        throw new BadRequestException(
          `Extra baggage is not available on flight ${flight.flightNumber}.`,
        );
      }
    }

    const newSegment: BookedSegment = {
      flightId: flight._id,
      flightNumber: flight.flightNumber,
      airlineId: flight.airlineId,
      airlineName: airline.name,
      cabinClass: cabin.cabinClass,
      departureAirport: {
        code: flight.departureAirport,
        timeZone: flight.departureTimeZone,
      },
      arrivalAirport: {
        code: flight.arrivalAirport,
        timeZone: flight.arrivalTimeZone,
      },
      departureAt: flight.departureAt,
      arrivalAt: flight.arrivalAt,
      fare: cabin.price,
      freeBags: cabin.freeBags,
      maxBagWeightKg: cabin.maxBagWeightKg,
    };
    const passengers: BookedPassenger[] = booking.passengers.map((p) => {
      const counts = (price: number) =>
        calculatePassengerPricing(price, {
          adults: p.type === PassengerType.Adult ? 1 : 0,
          children: p.type === PassengerType.Child ? 1 : 0,
          infants: p.type === PassengerType.Infant ? 1 : 0,
          seatsRequired: p.type === PassengerType.Infant ? 0 : 1,
        }).totalPrice;
      return {
        type: p.type,
        fullName: p.fullName,
        dateOfBirth: p.dateOfBirth,
        passportNumber: p.passportNumber,
        extraBags: p.extraBags.map((b) => ({ weightKg: b.weightKg })),
        fare: p.fare - counts(old.fare) + counts(cabin.price),
        baggageFee: p.baggageFee,
      };
    });
    const previousTotal = booking.totalAmount;
    const newTotal = passengers.reduce(
      (total, p) => total + p.fare + p.baggageFee,
      0,
    );
    const difference = newTotal - previousTotal;

    const payment = await this.connection
      .collection<{
        _id: Types.ObjectId;
        stripePaymentIntentId: string;
        amount: number;
        status: PaymentStatus;
      }>('payments')
      .findOne({
        bookingType: BookingType.Flight,
        bookingId: booking._id,
        status: PaymentStatus.Succeeded,
      });
    if (difference !== 0 && !payment) {
      throw new ConflictException('This booking has no successful payment.');
    }
    if (difference > 0 && !dto.paymentMethodId) {
      throw new BadRequestException(
        `The new flight costs ${formatMoney(difference, booking.currency)} more. Send paymentMethodId to pay the fare difference.`,
      );
    }

    // --- 2. charge a higher fare ---
    const changeId = new Types.ObjectId().toHexString();
    let newIntentId: string | null = null;
    if (difference > 0) {
      const charged = await this.fareChange.charge({
        bookingType: BookingType.Flight,
        bookingId: booking._id.toString(),
        userId,
        amount: newTotal,
        paymentMethodId: dto.paymentMethodId!,
        changeId,
      });
      newIntentId = charged.paymentIntentId;
      await this.fareChange.owe({
        changeId,
        bookingType: BookingType.Flight,
        bookingId: booking._id,
        userId: booking.userId,
        kind: 'compensation',
        paymentIntentId: newIntentId,
        amount: newTotal,
        currency: booking.currency,
      });
    }

    // --- 3. one transaction ---
    let updated: FlightBookingDocument | null = null;
    try {
      await this.connection.transaction(async (session) => {
        const seatsNeeded = booking.seats;
        const flightId = flight._id.toString();
        if (
          !(await this.seats.hold(
            flightId,
            cabin.cabinClass,
            seatsNeeded,
            session,
          )) ||
          !(await this.seats.convertHeldToBooked(
            flightId,
            cabin.cabinClass,
            seatsNeeded,
            session,
          ))
        ) {
          throw new ConflictException(NO_SEATS);
        }
        if (
          !(await this.seats.releaseBooked(
            old.flightId.toString(),
            old.cabinClass,
            seatsNeeded,
            session,
          ))
        ) {
          throw new ConflictException(
            'The seat counters of the old flight do not match this booking.',
          );
        }

        updated = await this.bookingModel
          .findOneAndUpdate(
            {
              _id: booking._id,
              userId: booking.userId,
              status: BookingStatus.Confirmed,
              [`segments.${index}.flightId`]: old.flightId,
            },
            {
              $set: {
                [`segments.${index}`]: newSegment,
                passengers,
                totalAmount: newTotal,
              },
              $push: {
                changes: {
                  changeId,
                  at: now,
                  segment: dto.segment,
                  fromFlightId: old.flightId,
                  toFlightId: flight._id,
                  fromFlightNumber: old.flightNumber,
                  toFlightNumber: flight.flightNumber,
                  previousTotal,
                  newTotal,
                },
              },
            },
            { session, new: true },
          )
          .exec();
        if (!updated) {
          throw new ConflictException(
            'The booking was changed or cancelled at the same time. Try again.',
          );
        }

        if (difference > 0 && payment && newIntentId) {
          const switched = await this.connection
            .collection('payments')
            .updateOne(
              {
                _id: payment._id,
                stripePaymentIntentId: payment.stripePaymentIntentId,
                status: PaymentStatus.Succeeded,
              },
              {
                $set: {
                  stripePaymentIntentId: newIntentId,
                  amount: newTotal,
                  updatedAt: now,
                },
              },
              { session },
            );
          if (switched.matchedCount !== 1) {
            throw new ConflictException(
              'The payment of this booking changed. Try again.',
            );
          }
          // The compensation refund is not needed any more; the old charge is given back.
          await this.fareChange.voidCompensation(changeId, session);
          await this.fareChange.owe(
            {
              changeId,
              bookingType: BookingType.Flight,
              bookingId: booking._id,
              userId: booking.userId,
              kind: 'old_intent',
              paymentIntentId: payment.stripePaymentIntentId,
              amount: payment.amount,
              currency: booking.currency,
            },
            session,
          );
        } else if (difference < 0 && payment) {
          const reduced = await this.connection
            .collection('payments')
            .updateOne(
              {
                _id: payment._id,
                amount: payment.amount,
                status: PaymentStatus.Succeeded,
              },
              { $set: { amount: payment.amount + difference, updatedAt: now } },
              { session },
            );
          if (reduced.matchedCount !== 1) {
            throw new ConflictException(
              'The payment of this booking changed. Try again.',
            );
          }
          await this.fareChange.owe(
            {
              changeId,
              bookingType: BookingType.Flight,
              bookingId: booking._id,
              userId: booking.userId,
              kind: 'difference',
              paymentIntentId: payment.stripePaymentIntentId,
              amount: -difference,
              currency: booking.currency,
            },
            session,
          );
        }
      });
    } catch (error) {
      // Nothing was saved. A charge made in step 2 is given back (retried every minute if
      // Stripe fails now).
      if (newIntentId) await this.fareChange.processChange(changeId);
      throw error;
    }
    if (!updated) throw new Error('The change was not saved.');

    // --- 4. after the commit ---
    await this.fareChange.processChange(changeId).catch((error: unknown) => {
      this.logger.error(`Fare change ${changeId} refund: ${String(error)}`);
    });
    await this.seatSelection.clearSegment(booking._id, index);
    const result = updated as FlightBookingDocument;
    await this.notifyUser(userId, result, difference);
    return {
      ...this.bookings.toResponse(result),
      fareChange: {
        direction:
          difference > 0 ? 'charged' : difference < 0 ? 'refunded' : 'none',
        amount: Math.abs(difference),
        previousTotal,
        newTotal,
        currency: booking.currency,
      },
    };
  }

  private async notifyUser(
    userId: string,
    booking: FlightBooking,
    difference: number,
  ): Promise<void> {
    const money =
      difference > 0
        ? ` The fare difference of ${formatMoney(difference, booking.currency)} was charged to your card (your previous payment is refunded in full).`
        : difference < 0
          ? ` The fare difference of ${formatMoney(-difference, booking.currency)} is being refunded to your card.`
          : '';
    const now = booking.segments
      .map(
        (s) =>
          `${s.flightNumber} ${s.departureAirport.code} → ${s.arrivalAirport.code}, departs ${localTime(s.departureAt, s.departureAirport.timeZone)}`,
      )
      .join('; ');
    await this.notifications.notify(
      userId,
      'Flight changed',
      `Booking ${booking.reference} now has: ${now}. Seats you picked on the changed flight were cleared; pick them again.${money}`,
    );
  }
}
