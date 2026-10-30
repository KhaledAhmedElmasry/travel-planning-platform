import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Connection, Model } from 'mongoose';
import { AirlinesService } from '../airlines/airlines.service';
import { BookingStatus, BookingType } from '../common/enums';
import { allowedFrom, canTransition } from '../payments/booking-lifecycle';
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
import { SeatInventoryService } from './seat-inventory.service';

// Area: Payments, Holds & Booking Engine
// Requirements: FLT-22 (hold expiry), FLT-26 (cancellation), PAY-03, GEN-11 (completion), NEW-01
// Status changes that also touch the seat counters, payments and refunds. Kept apart from
// FlightBookingsService so that the payments module (which uses FlightBookingsService) and this
// service (which uses the payments module) do not depend on each other in a circle.
//
// WAITING FOR: AirlinesService.getRefundTier() (Area 5, FLT-09); until then cancel answers 501
// before changing anything.
// TODO(GEN-01, Area 3): notify the user on cancellation and refund.
// GEN-11: every status change below uses allowedFrom() / canTransition() from
// payments/booking-lifecycle.ts, so only the allowed transitions can happen.

const DAY_MS = 24 * 60 * 60 * 1000;
// How many bookings one run of a job handles (the next run takes the rest).
const JOB_BATCH = 100;

// FLT-09: whole days left before departure, used to pick the airline's tier. The refund preview
// in the booking details (FLT-25, FLT-26; Area 6) must use this too, so the amount shown before
// cancelling is the amount refunded.
export function daysBeforeDeparture(departureAt: Date, now = new Date()) {
  return Math.floor((departureAt.getTime() - now.getTime()) / DAY_MS);
}

export interface CancelledFlightBookingResponse extends FlightBookingResponse {
  // null when the tier gives 0% (no refund is created).
  refund: RefundResponse | null;
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
  ) {}

  // POST /api/flight-bookings/:id/cancel (FLT-26): only the owner, only a Confirmed booking, only
  // before departure. A round trip is cancelled as a whole with the outbound flight's tier (FLT-12).
  async cancel(
    userId: string,
    bookingId: string,
  ): Promise<CancelledFlightBookingResponse> {
    const booking = await this.bookings.findOwned(userId, bookingId);
    if (!canTransition(booking.status, BookingStatus.Cancelled)) {
      throw new ConflictException(
        `This booking is ${booking.status}; only a confirmed booking can be cancelled.`,
      );
    }
    const now = new Date();
    const outbound = booking.segments[0];
    if (outbound.departureAt <= now) {
      throw new ConflictException(
        'The flight has already departed; the booking cannot be cancelled.',
      );
    }

    // Asked before anything changes, so a missing tier rule leaves the booking untouched.
    const tier = await this.airlines.getRefundTier(
      outbound.airlineId.toString(),
      daysBeforeDeparture(outbound.departureAt, now),
    );

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
              refundPercentage: tier.refundPercentage,
              tierDaysBefore: tier.tierDaysBefore,
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
    // TODO(GEN-01, Area 3): notify the user that the booking was cancelled (and the refund).

    return { ...this.bookings.toResponse(state.cancelled), refund };
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
