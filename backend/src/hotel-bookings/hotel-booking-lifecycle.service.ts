import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Connection, Model } from 'mongoose';
import { BookingStatus, BookingType } from '../common/enums';
import { HotelsService } from '../hotels/hotels.service';
import { PaymentsService } from '../payments/payments.service';
import { RefundResponse, RefundsService } from '../payments/refunds.service';
import { RefundReason } from '../payments/schemas/refund.schema';
import {
  HotelBookingResponse,
  HotelBookingsService,
} from './hotel-bookings.service';
import { RoomInventoryService } from './room-inventory.service';
import {
  HotelBooking,
  HotelBookingDocument,
} from './schemas/hotel-booking.schema';
import { daysBeforeCheckIn } from './stay-dates';

// Area: Payments, Holds & Booking Engine
// Requirements: HTL-18 (hold expiry), HTL-21 (cancellation), PAY-03, GEN-11, NEW-01
// Status changes that also touch the room-nights, payments and refunds. Kept apart from
// HotelBookingsService so that the payments module (which uses HotelBookingsService) and this
// service (which uses the payments module) do not depend on each other in a circle.
//
// WAITING FOR: HotelsService.getRefundTier() (Area 7, HTL-10); until then cancel answers 501
// before changing anything.
// TODO(GEN-01, Area 3): notify the user on cancellation and refund.
// TODO(NEW-01, HTL-23): also mark Confirmed reservations Completed once the check-out date has
// passed (Area 4's reviews need it).

// How many reservations one run of a job handles (the next run takes the rest).
const JOB_BATCH = 100;

export interface CancelledHotelBookingResponse extends HotelBookingResponse {
  // null when the tier gives 0% (no refund is created).
  refund: RefundResponse | null;
}

@Injectable()
export class HotelBookingLifecycleService {
  private readonly logger = new Logger(HotelBookingLifecycleService.name);

  constructor(
    @InjectModel(HotelBooking.name)
    private readonly bookingModel: Model<HotelBooking>,
    @InjectConnection() private readonly connection: Connection,
    private readonly bookings: HotelBookingsService,
    private readonly inventory: RoomInventoryService,
    private readonly hotels: HotelsService,
    private readonly payments: PaymentsService,
    private readonly refunds: RefundsService,
  ) {}

  // POST /api/hotel-bookings/:id/cancel (HTL-21): only the owner, only a Confirmed reservation,
  // only as a whole and only before the check-in date. The refund is the hotel's tier for the days
  // left, on the full total.
  async cancel(
    userId: string,
    bookingId: string,
  ): Promise<CancelledHotelBookingResponse> {
    const booking = await this.bookings.findOwned(userId, bookingId);
    if (booking.status !== BookingStatus.Confirmed) {
      throw new ConflictException(
        `This reservation is ${booking.status}; only a confirmed reservation can be cancelled.`,
      );
    }
    const now = new Date();
    const daysLeft = daysBeforeCheckIn(booking.checkIn, now);
    if (daysLeft <= 0) {
      throw new ConflictException(
        'The check-in date has been reached; the reservation can no longer be cancelled.',
      );
    }

    // Asked before anything changes, so a missing tier rule leaves the reservation untouched.
    const tier = await this.hotels.getRefundTier(
      booking.hotelId.toString(),
      daysLeft,
    );

    const state: { cancelled: HotelBookingDocument | null } = {
      cancelled: null,
    };
    await this.connection.transaction(async (session) => {
      const cancelled = await this.bookingModel.findOneAndUpdate(
        { _id: bookingId, userId, status: BookingStatus.Confirmed },
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
          'This reservation is no longer confirmed and cannot be cancelled.',
        );
      }
      // All its rooms are free again for those dates.
      await this.inventory.releaseBooked(cancelled._id, session);
      state.cancelled = cancelled;
    });
    if (!state.cancelled) throw new Error('The reservation was not cancelled.');

    // PAY-03: refund the tier percentage of the amount paid (nothing for 0%).
    const refund = await this.issuePendingRefund(state.cancelled);
    // TODO(GEN-01, Area 3): notify the user that the reservation was cancelled (and the refund).

    return { ...this.bookings.toResponse(state.cancelled), refund };
  }

  // HTL-18, NEW-01: every minute, reservations still pending payment after their 10-minute hold
  // become expired, their held room-nights are released and the Stripe PaymentIntent is
  // cancelled. Safe to run again or in parallel: each reservation changes only if still pending.
  @Cron(CronExpression.EVERY_MINUTE, { name: 'hotel-booking-hold-expiry' })
  async expireHolds(): Promise<number> {
    const now = new Date();
    const due = await this.bookingModel
      .find({
        status: BookingStatus.PendingPayment,
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
          `Could not expire hotel reservation ${_id.toString()}: ${String(err)}`,
        );
      }
    }
    if (expired > 0)
      this.logger.log(`Expired ${expired} hotel reservation hold(s).`);
    return expired;
  }

  // PAY-03: every minute, refunds still owed by cancellations are created. This only finds
  // something if the server stopped between a cancellation and its refund. Waits one minute so
  // it does not run at the same time as the cancel request that is still creating the refund.
  @Cron(CronExpression.EVERY_MINUTE, { name: 'hotel-booking-owed-refunds' })
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
          `Could not refund hotel reservation ${booking._id.toString()}: ${String(err)}`,
        );
      }
    }
    if (issued > 0)
      this.logger.log(`Issued ${issued} owed hotel reservation refund(s).`);
    return issued;
  }

  private async expireOne(bookingId: string, now: Date): Promise<boolean> {
    const state: { expired: HotelBookingDocument | null } = { expired: null };
    await this.connection.transaction(async (session) => {
      const expired = await this.bookingModel.findOneAndUpdate(
        {
          _id: bookingId,
          status: BookingStatus.PendingPayment,
          holdExpiresAt: { $lte: now },
        },
        { $set: { status: BookingStatus.Expired, expiredAt: now } },
        { new: true, session },
      );
      if (!expired) return;
      await this.inventory.releaseHeld(expired._id, session);
      state.expired = expired;
    });
    if (!state.expired) return false;

    // PAY-01: the unpaid PaymentIntent can no longer be paid.
    await this.payments.cancelPaymentForBooking(BookingType.Hotel, bookingId);
    return true;
  }

  // Creates the refund saved in pendingRefund, then clears it. Safe to repeat: the second time
  // refundBooking() returns the refund already created.
  private async issuePendingRefund(
    booking: HotelBookingDocument,
  ): Promise<RefundResponse | null> {
    const owed = booking.pendingRefund;
    if (!owed) {
      return this.refunds.findRefundForBooking(
        BookingType.Hotel,
        booking._id.toString(),
      );
    }
    const refund = await this.refunds.refundBooking({
      bookingType: BookingType.Hotel,
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
}
