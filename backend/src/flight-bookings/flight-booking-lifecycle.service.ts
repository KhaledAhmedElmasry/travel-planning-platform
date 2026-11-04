import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { AirlinesService } from '../airlines/airlines.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BookingStatus, BookingType, CabinClass } from '../common/enums';
import { allowedFrom, canTransition } from '../payments/booking-lifecycle';
import { claimNotification } from '../payments/claim-notification';
import {
  CancellationPreview,
  cancellablePreview,
  notCancellablePreview,
} from '../payments/cancellation-preview';
import { PaymentsService } from '../payments/payments.service';
import { RefundResponse, RefundsService } from '../payments/refunds.service';
import { RefundReason } from '../payments/schemas/refund.schema';
import {
  FlightBookingResponse,
  FlightBookingsService,
} from './flight-bookings.service';
import {
  FlightBooking,
  FlightBookingDocument,
} from './schemas/flight-booking.schema';
import {
  flightCancelledByAirlineText,
  flightCancelledText,
  flightHoldEndedByAirlineText,
} from './booking-notifications';
import { SeatInventoryService } from './seat-inventory.service';

// Area: Payments, Holds & Booking Engine
// Requirements: FLT-22 (hold expiry), FLT-26 (cancellation + refund preview), FLT-06 / NEW-02
// (bookings of a flight the airline cancels), PAY-03, GEN-11 (completion), NEW-01
// Status changes that also touch the seat counters, payments and refunds. Kept apart from
// FlightBookingsService so that the payments module (which uses FlightBookingsService) and this
// service (which uses the payments module) do not depend on each other in a circle.
//
// Used by other areas (FlightBookingsModule exports this service):
//   - previewCancellation(): the refund shown in the booking details (FLT-25, FLT-26; Area 6);
//   - cancelBookingsForFlight() + finishFlightCancellation(): POST /api/flights/:id/cancel
//     (FLT-06, NEW-02; Area 5).
//
// WAITING FOR: AirlinesService.getRefundTier() (Area 5, FLT-09); until then cancel and the preview
// of a confirmed booking answer 501 before changing anything.
// GEN-01: the user is notified of each cancellation (with the refund); RefundsService notifies
// when the refund is refunded or failed.
// GEN-11: every status change below uses allowedFrom() / canTransition() from
// payments/booking-lifecycle.ts, so only the allowed transitions can happen.

const DAY_MS = 24 * 60 * 60 * 1000;
// How many bookings one run of a job handles (the next run takes the rest).
const JOB_BATCH = 100;

// FLT-09: whole days left before departure, used to pick the airline's tier (by cancel() and
// the refund preview, through previewCancellation()).
export function daysBeforeDeparture(departureAt: Date, now = new Date()) {
  return Math.floor((departureAt.getTime() - now.getTime()) / DAY_MS);
}

export interface CancelledFlightBookingResponse extends FlightBookingResponse {
  // null when the tier gives 0% (no refund is created).
  refund: RefundResponse | null;
}

// The bookings changed by cancelBookingsForFlight(), for finishFlightCancellation() and for the
// response of POST /api/flights/:id/cancel ("the number of bookings that were cancelled").
export interface FlightCancellationResult {
  flightId: string;
  // Were confirmed: now cancelled, a 100% refund is owed (PAY-03).
  cancelledBookingIds: string[];
  // Were pending payment: now expired, their PaymentIntent must be cancelled (PAY-01).
  expiredBookingIds: string[];
}

@Injectable()
export class FlightBookingLifecycleService {
  private readonly logger = new Logger(FlightBookingLifecycleService.name);

  constructor(
    @InjectModel(FlightBooking.name)
    private readonly bookingModel: Model<FlightBooking>,
    @InjectConnection() private readonly connection: Connection,
    private readonly bookings: FlightBookingsService,
    private readonly seats: SeatInventoryService,
    private readonly airlines: AirlinesService,
    private readonly payments: PaymentsService,
    private readonly refunds: RefundsService,
    private readonly notifications: NotificationsService,
  ) {}

  // FLT-26: what the user would get back by cancelling now, from the airline's tier for the days
  // left before the outbound departure (FLT-09). Shown in the booking details (FLT-25, Area 6:
  // call it with the booking from FlightBookingsService.findOwned()). cancel() uses the same
  // function, so the refund given is the refund shown.
  async previewCancellation(
    booking: FlightBookingDocument,
    now = new Date(),
  ): Promise<CancellationPreview> {
    if (!canTransition(booking.status, BookingStatus.Cancelled)) {
      return notCancellablePreview(
        `This booking is ${booking.status}; only a confirmed booking can be cancelled.`,
        booking.currency,
      );
    }
    const outbound = booking.segments[0];
    if (outbound.departureAt <= now) {
      return notCancellablePreview(
        'The flight has already departed; the booking cannot be cancelled.',
        booking.currency,
      );
    }
    const daysBefore = daysBeforeDeparture(outbound.departureAt, now);
    const tier = await this.airlines.getRefundTier(
      outbound.airlineId.toString(),
      daysBefore,
    );
    return cancellablePreview(
      booking.totalAmount,
      booking.currency,
      daysBefore,
      tier,
    );
  }

  // POST /api/flight-bookings/:id/cancel (FLT-26): only the owner, only a Confirmed booking, only
  // before departure. A round trip is cancelled as a whole with the outbound flight's tier (FLT-12).
  async cancel(
    userId: string,
    bookingId: string,
  ): Promise<CancelledFlightBookingResponse> {
    const booking = await this.bookings.findOwned(userId, bookingId);
    const now = new Date();
    // Checked and priced before anything changes, so a missing tier rule leaves the booking
    // untouched.
    const preview = await this.previewCancellation(booking, now);
    if (!preview.cancellable) throw new ConflictException(preview.reason);

    const state: { cancelled: FlightBookingDocument | null } = {
      cancelled: null,
    };
    await this.connection.transaction(async (session) => {
      const cancelled = await this.bookingModel.findOneAndUpdate(
        {
          _id: bookingId,
          userId,
          status: { $in: allowedFrom(BookingStatus.Cancelled) },
        },
        {
          $set: {
            status: BookingStatus.Cancelled,
            cancelledAt: now,
            // Saved with the cancellation, so the refund cannot be lost (see issueOwedRefunds).
            pendingRefund: {
              refundPercentage: preview.refundPercentage,
              tierDaysBefore: preview.tierDaysBefore,
              reason: RefundReason.UserCancellation,
            },
          },
        },
        { new: true, session },
      );
      if (!cancelled) {
        // Cancelled by another request at the same moment.
        throw new ConflictException(
          'This booking is no longer confirmed and cannot be cancelled.',
        );
      }
      for (const segment of cancelled.segments) {
        await this.seats.releaseBooked(
          segment.flightId.toString(),
          segment.cabinClass,
          cancelled.seats,
          session,
        );
      }
      state.cancelled = cancelled;
    });
    if (!state.cancelled) throw new Error('The booking was not cancelled.');

    // PAY-03: refund the tier percentage of the amount paid (nothing for 0%).
    const refund = await this.issuePendingRefund(state.cancelled);
    // GEN-01: only the request that cancelled the booking gets here, so it is sent once.
    const { title, message } = flightCancelledText(state.cancelled, refund);
    await this.notifications.notify(state.cancelled.userId, title, message);

    return { ...this.bookings.toResponse(state.cancelled), refund };
  }

  // FLT-06, NEW-02 (Area 5): the airline cancels flight `flightId`. Call this INSIDE the
  // transaction that sets the flight's status to 'cancelled', with the same session, so the
  // flight and its bookings change together (that flight write also stops new seat holds). After
  // the transaction committed, call finishFlightCancellation() with the result.
  // Every booking with a segment on this flight changes as a whole (a round trip too, so the seats
  // of its other flight are released as well):
  //   - confirmed -> cancelled, booked seats released, a 100% refund owed (PAY-03);
  //   - pending_payment -> expired, held seats released.
  // Completed, expired and cancelled bookings are not touched (GEN-11).
  async cancelBookingsForFlight(
    flightId: string,
    session: ClientSession,
  ): Promise<FlightCancellationResult> {
    const now = new Date();
    const affected = await this.bookingModel
      .find({
        'segments.flightId': new Types.ObjectId(flightId),
        status: {
          $in: [
            ...allowedFrom(BookingStatus.Cancelled),
            ...allowedFrom(BookingStatus.Expired),
          ],
        },
      })
      .session(session);
    const toCancel = affected.filter((b) =>
      canTransition(b.status, BookingStatus.Cancelled),
    );
    const toExpire = affected.filter(
      (b) => !canTransition(b.status, BookingStatus.Cancelled),
    );

    await this.changeStatusOfAll(
      toCancel,
      BookingStatus.Cancelled,
      {
        cancelledAt: now,
        // Saved with the cancellation, so the refund cannot be lost (see issueOwedRefunds).
        pendingRefund: {
          refundPercentage: 100,
          tierDaysBefore: null,
          reason: RefundReason.ProviderCancellation,
        },
      },
      session,
    );
    await this.changeStatusOfAll(
      toExpire,
      BookingStatus.Expired,
      { expiredAt: now },
      session,
    );
    await this.releaseSeatsOf(toCancel, 'booked', session);
    await this.releaseSeatsOf(toExpire, 'held', session);

    return {
      flightId,
      cancelledBookingIds: toCancel.map((b) => b._id.toString()),
      expiredBookingIds: toExpire.map((b) => b._id.toString()),
    };
  }

  // FLT-06, NEW-02 (Area 5): call after the transaction of cancelBookingsForFlight() committed.
  // Refunds 100% of every cancelled booking through Stripe (PAY-03) and cancels the PaymentIntents
  // of the expired ones (PAY-01). Safe to call twice. Errors are logged, not thrown: a refund that
  // could not be created is created by the owed-refunds job, and a payment that still succeeds for
  // an expired booking is refunded in full by the webhook.
  async finishFlightCancellation(
    result: FlightCancellationResult,
  ): Promise<void> {
    for (const bookingId of result.cancelledBookingIds) {
      try {
        const booking = await this.bookingModel.findById(bookingId);
        if (booking) await this.issuePendingRefund(booking);
      } catch (err) {
        this.logger.error(
          `Could not refund flight booking ${bookingId} (flight ${result.flightId} cancelled): ${String(err)}`,
        );
      }
      // Sent even if the refund failed above: the booking is cancelled either way, and the
      // owed-refunds job creates the refund later.
      await this.notifyOnce(bookingId, flightCancelledByAirlineText);
    }
    for (const bookingId of result.expiredBookingIds) {
      try {
        await this.payments.cancelPaymentForBooking(
          BookingType.Flight,
          bookingId,
        );
      } catch (err) {
        this.logger.error(
          `Could not cancel the payment of flight booking ${bookingId}: ${String(err)}`,
        );
      }
      await this.notifyOnce(bookingId, flightHoldEndedByAirlineText);
    }
  }

  // NEW-02: every affected user is notified once, even if finishFlightCancellation() runs again.
  // Errors are logged, not thrown, like the rest of finishFlightCancellation().
  private async notifyOnce(
    bookingId: string,
    text: (booking: FlightBooking) => { title: string; message: string },
  ): Promise<void> {
    try {
      const booking = await this.bookingModel.findById(bookingId);
      if (!booking) return;
      if (
        !(await claimNotification(
          this.bookingModel,
          booking._id,
          'airline_cancelled_flight',
        ))
      )
        return;
      const { title, message } = text(booking);
      await this.notifications.notify(booking.userId, title, message);
    } catch (err) {
      this.logger.error(
        `Could not notify the user of flight booking ${bookingId}: ${String(err)}`,
      );
    }
  }

  // GEN-11, NEW-01: every minute, Confirmed bookings whose LAST flight has departed (the return
  // flight of a round trip) become Completed. One update for all of them; nothing else changes
  // (the seats stay booked). Completed is final: it can no longer be cancelled or paid.
  @Cron(CronExpression.EVERY_MINUTE, { name: 'flight-booking-completion' })
  async completeDeparted(): Promise<number> {
    const now = new Date();
    const result = await this.bookingModel.updateMany(
      {
        status: { $in: allowedFrom(BookingStatus.Completed) },
        // $max over the segments' departure times = the last departure of the booking.
        $expr: { $lte: [{ $max: '$segments.departureAt' }, now] },
      },
      { $set: { status: BookingStatus.Completed, completedAt: now } },
    );
    if (result.modifiedCount > 0)
      this.logger.log(`Completed ${result.modifiedCount} flight booking(s).`);
    return result.modifiedCount;
  }

  // PAY-03: every minute, refunds still owed by cancellations are created. This only finds
  // something if the server stopped between a cancellation and its refund. Waits one minute so
  // it does not run at the same time as the cancel request that is still creating the refund.
  @Cron(CronExpression.EVERY_MINUTE, { name: 'flight-booking-owed-refunds' })
  async issueOwedRefunds(): Promise<number> {
    const due = await this.bookingModel
      .find({
        status: BookingStatus.Cancelled,
        pendingRefund: { $ne: null },
        cancelledAt: { $lte: new Date(Date.now() - 60 * 1000) },
      })
      .limit(JOB_BATCH);

    let issued = 0;
    for (const booking of due) {
      try {
        await this.issuePendingRefund(booking);
        issued++;
      } catch (err) {
        this.logger.error(
          `Could not refund flight booking ${booking._id.toString()}: ${String(err)}`,
        );
      }
    }
    if (issued > 0)
      this.logger.log(`Issued ${issued} owed flight booking refund(s).`);
    return issued;
  }

  // One update for all `bookings`, still filtered on the GEN-11 rule. Inside the transaction a
  // concurrent change makes MongoDB retry the whole transaction, so a different count means a bug:
  // abort rather than change only some of them.
  private async changeStatusOfAll(
    bookings: FlightBookingDocument[],
    to: BookingStatus,
    set: Record<string, unknown>,
    session: ClientSession,
  ): Promise<void> {
    if (bookings.length === 0) return;
    const result = await this.bookingModel.updateMany(
      {
        _id: { $in: bookings.map((b) => b._id) },
        status: { $in: allowedFrom(to) },
      },
      { $set: { status: to, ...set } },
      { session },
    );
    if (result.modifiedCount !== bookings.length) {
      throw new Error(
        `Only ${result.modifiedCount} of ${bookings.length} flight bookings could become ${to}.`,
      );
    }
  }

  // Releases the booked or held seats of `bookings` on every flight they use: one counter update
  // per flight and cabin, however many bookings there are.
  private async releaseSeatsOf(
    bookings: FlightBookingDocument[],
    counter: 'booked' | 'held',
    session: ClientSession,
  ): Promise<void> {
    const perCabin = new Map<
      string,
      { flightId: string; cabinClass: CabinClass; seats: number }
    >();
    for (const booking of bookings) {
      for (const segment of booking.segments) {
        const flightId = segment.flightId.toString();
        const key = `${flightId}:${segment.cabinClass}`;
        const entry = perCabin.get(key) ?? {
          flightId,
          cabinClass: segment.cabinClass,
          seats: 0,
        };
        entry.seats += booking.seats;
        perCabin.set(key, entry);
      }
    }
    for (const { flightId, cabinClass, seats } of perCabin.values()) {
      if (counter === 'booked') {
        await this.seats.releaseBooked(flightId, cabinClass, seats, session);
      } else {
        await this.seats.releaseHeld(flightId, cabinClass, seats, session);
      }
    }
  }

  // Creates the refund saved in pendingRefund, then clears it. Safe to repeat: the second time
  // refundBooking() returns the refund already created.
  private async issuePendingRefund(
    booking: FlightBookingDocument,
  ): Promise<RefundResponse | null> {
    const owed = booking.pendingRefund;
    if (!owed) {
      return this.refunds.findRefundForBooking(
        BookingType.Flight,
        booking._id.toString(),
      );
    }
    const refund = await this.refunds.refundBooking({
      bookingType: BookingType.Flight,
      bookingId: booking._id.toString(),
      refundPercentage: owed.refundPercentage,
      reason: owed.reason,
      tierDaysBefore: owed.tierDaysBefore,
    });
    await this.bookingModel.updateOne(
      { _id: booking._id },
      { $set: { pendingRefund: null } },
    );
    return refund;
  }

  // FLT-22, NEW-01: every minute, bookings still pending payment after their 10-minute hold
  // become expired, their held seats are released and the Stripe PaymentIntent is cancelled.
  // Safe to run again or in parallel: each booking changes only if it is still pending.
  @Cron(CronExpression.EVERY_MINUTE, { name: 'flight-booking-hold-expiry' })
  async expireHolds(): Promise<number> {
    const now = new Date();
    const due = await this.bookingModel
      .find({
        status: { $in: allowedFrom(BookingStatus.Expired) },
        holdExpiresAt: { $lte: now },
      })
      .select('_id')
      .limit(JOB_BATCH);

    let expired = 0;
    for (const { _id } of due) {
      try {
        if (await this.expireOne(_id.toString(), now)) expired++;
      } catch (err) {
        this.logger.error(
          `Could not expire flight booking ${_id.toString()}: ${String(err)}`,
        );
      }
    }
    if (expired > 0)
      this.logger.log(`Expired ${expired} flight booking hold(s).`);
    return expired;
  }

  private async expireOne(bookingId: string, now: Date): Promise<boolean> {
    const state: { expired: FlightBookingDocument | null } = { expired: null };
    await this.connection.transaction(async (session) => {
      const expired = await this.bookingModel.findOneAndUpdate(
        {
          _id: bookingId,
          status: { $in: allowedFrom(BookingStatus.Expired) },
          holdExpiresAt: { $lte: now },
        },
        { $set: { status: BookingStatus.Expired, expiredAt: now } },
        { new: true, session },
      );
      if (!expired) return;
      for (const segment of expired.segments) {
        await this.seats.releaseHeld(
          segment.flightId.toString(),
          segment.cabinClass,
          expired.seats,
          session,
        );
      }
      state.expired = expired;
    });
    if (!state.expired) return false;

    // PAY-01: the unpaid PaymentIntent can no longer be paid.
    await this.payments.cancelPaymentForBooking(BookingType.Flight, bookingId);
    return true;
  }
}
