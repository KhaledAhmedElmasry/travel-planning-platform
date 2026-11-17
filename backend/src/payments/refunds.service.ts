import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import Stripe from 'stripe';
import { BookingType } from '../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { claimNotification } from './claim-notification';
import { formatMoney } from './format-money';
import { isDuplicateKeyError } from './is-duplicate-key-error';
import { Payment, PaymentStatus } from './schemas/payment.schema';
import {
  Refund,
  RefundDocument,
  RefundReason,
  RefundStatus,
} from './schemas/refund.schema';
import { STRIPE_CLIENT } from './stripe.provider';

// Area: Payments & Refunds
// PAY-03: every cancellation with a positive refund amount is refunded through the Stripe
// Refunds API, recorded, and its status (pending, refunded, failed) is shown on the booking.
//
// Who calls refundBooking():
//   - PaymentsService, when a payment succeeds after the hold expired (100%, done).
//   - FlightBookingLifecycleService.cancel (FLT-26, done), with the airline tier for the days
//     left before departure, from the tiers accepted with the policies (PAY-02, FLT-09).
//   - HotelBookingLifecycleService.cancel (HTL-21, done), with the hotel tier for the days left
//     before check-in, on the full total, from the tiers accepted with the policies (PAY-02,
//     HTL-10).
//   - FlightBookingLifecycleService.finishFlightCancellation (FLT-06, done; called by
//     Area 5 when the airline cancels a flight): 100% for each Confirmed booking.
//   Those modules need forwardRef to PaymentsModule (see payments.module.ts).
// Booking details (FLT-25, HTL-20) show the refund with findRefundForBooking().
// GEN-01: the user is notified once when the refund is refunded or failed, and when a late
// payment is refunded; the cancellation notification itself already gives the refund amount.

export interface RefundBookingInput {
  bookingType: BookingType;
  bookingId: string;
  // 0-100. From the provider's tier for a user cancellation, 100 otherwise.
  refundPercentage: number;
  reason: RefundReason;
  // The daysBefore of the tier used (user cancellations only).
  tierDaysBefore?: number | null;
}

export interface RefundResponse {
  id: string;
  bookingType: BookingType;
  bookingId: string;
  paymentId: string;
  amount: number;
  currency: string;
  refundPercentage: number;
  tierDaysBefore: number | null;
  reason: RefundReason;
  status: RefundStatus;
  stripeRefundId: string | null;
  failureReason: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    @InjectModel(Refund.name) private readonly refundModel: Model<Refund>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly notifications: NotificationsService,
  ) {}

  // Refunds a percentage of what was paid for a booking. Returns null when the amount is 0
  // (e.g. a 0% tier): no refund is created. Safe to call twice: the same refund is returned.
  async refundBooking(
    input: RefundBookingInput,
  ): Promise<RefundResponse | null> {
    const { refundPercentage } = input;
    if (
      !Number.isFinite(refundPercentage) ||
      refundPercentage < 0 ||
      refundPercentage > 100
    ) {
      throw new RangeError('refundPercentage must be between 0 and 100.');
    }

    const payment = await this.paymentModel.findOne({
      bookingType: input.bookingType,
      bookingId: input.bookingId,
      status: PaymentStatus.Succeeded,
    });
    if (!payment) {
      throw new ConflictException(
        'This booking has no successful payment to refund.',
      );
    }

    const existing = await this.refundModel.findOne({ paymentId: payment._id });
    if (existing) return this.toResponse(await this.sendToStripe(existing));

    const amount = percentOfCents(payment.amount, refundPercentage);
    if (amount < 1) return null;

    let refund: RefundDocument;
    try {
      refund = await this.refundModel.create({
        bookingType: input.bookingType,
        bookingId: input.bookingId,
        userId: payment.userId,
        paymentId: payment._id,
        amount,
        currency: payment.currency,
        refundPercentage,
        tierDaysBefore: input.tierDaysBefore ?? null,
        reason: input.reason,
        status: RefundStatus.Pending,
      });
    } catch (err) {
      // Two calls at the same time: the unique paymentId index lets only one insert win.
      const winner = isDuplicateKeyError(err)
        ? await this.refundModel.findOne({ paymentId: payment._id })
        : null;
      if (!winner) throw err;
      return this.toResponse(winner);
    }

    // A cancellation notifies the user itself (with the refund amount). A payment that arrived after
    // the hold ended has no other message, so it is explained here (only the insert winner gets here).
    if (refund.reason === RefundReason.HoldExpired) {
      await this.notifications.notify(
        refund.userId,
        'Late payment refunded',
        `Your payment arrived after the 10-minute hold of your ${refund.bookingType} booking had ended, so the booking was not confirmed. ${formatMoney(refund.amount, refund.currency)} is being refunded in full.`,
      );
    }
    return this.toResponse(await this.sendToStripe(refund));
  }

  // GET /api/refunds/:id (PAY-03)
  async getRefund(userId: string, refundId: string): Promise<RefundResponse> {
    const refund = isValidObjectId(refundId)
      ? await this.refundModel.findOne({ _id: refundId, userId })
      : null;
    if (!refund) throw new NotFoundException('Refund not found.');
    return this.toResponse(refund);
  }

  // For the booking details (FLT-25, HTL-20): the refund of a booking, or null.
  async findRefundForBooking(
    bookingType: BookingType,
    bookingId: string,
  ): Promise<RefundResponse | null> {
    if (!isValidObjectId(bookingId)) return null;
    const refund = await this.refundModel.findOne({ bookingType, bookingId });
    return refund ? this.toResponse(refund) : null;
  }

  // Webhook events refund.created / refund.updated / refund.failed (PAY-03). Events can arrive
  // out of order, so the current state is read from Stripe instead of trusting the event.
  async onStripeRefundEvent(eventRefund: Stripe.Refund): Promise<void> {
    const refundId = eventRefund.metadata?.refundId;
    const refund =
      (await this.refundModel.findOne({ stripeRefundId: eventRefund.id })) ??
      (refundId && isValidObjectId(refundId)
        ? await this.refundModel.findById(refundId)
        : null);
    if (!refund) {
      this.logger.warn(
        `Ignoring Stripe refund ${eventRefund.id}: no refund record.`,
      );
      return;
    }

    const current = await this.stripe.refunds.retrieve(eventRefund.id);
    refund.stripeRefundId = current.id;
    this.applyStripeStatus(refund, current);
    await refund.save();
    await this.notifyFinalStatus(refund);
  }

  // --- Helpers ---

  // Sends the refund to Stripe if that has not happened yet (also retries one that failed
  // before reaching Stripe). The idempotency key makes a repeated request create one refund.
  private async sendToStripe(refund: RefundDocument): Promise<RefundDocument> {
    if (refund.stripeRefundId) return refund;

    const payment = await this.paymentModel.findById(refund.paymentId);
    if (!payment)
      throw new Error(`Payment ${refund.paymentId.toString()} not found.`);

    try {
      const stripeRefund = await this.stripe.refunds.create(
        {
          payment_intent: payment.stripePaymentIntentId,
          amount: refund.amount,
          metadata: {
            refundId: refund._id.toString(),
            bookingType: refund.bookingType,
            bookingId: refund.bookingId.toString(),
          },
        },
        { idempotencyKey: `refund-${refund._id.toString()}` },
      );
      refund.stripeRefundId = stripeRefund.id;
      this.applyStripeStatus(refund, stripeRefund);
    } catch (err) {
      if (!(err instanceof Stripe.errors.StripeError)) throw err;
      // Recorded as failed so the user sees it; calling refundBooking() again retries it.
      this.logger.error(
        `Stripe refund for ${refund._id.toString()} failed: ${err.message}`,
      );
      refund.status = RefundStatus.Failed;
      refund.failureReason = err.message;
    }
    await refund.save();
    await this.notifyFinalStatus(refund);
    return refund;
  }

  // GEN-01, PAY-03: one notification when the refund reaches refunded or failed, whichever of the
  // Stripe reply and the webhook saw it first.
  private async notifyFinalStatus(refund: RefundDocument): Promise<void> {
    if (
      refund.status !== RefundStatus.Refunded &&
      refund.status !== RefundStatus.Failed
    )
      return;
    if (!(await claimNotification(this.refundModel, refund._id, refund.status)))
      return;
    const amount = formatMoney(refund.amount, refund.currency);
    await this.notifications.notify(
      refund.userId,
      refund.status === RefundStatus.Refunded
        ? 'Refund completed'
        : 'Refund failed',
      refund.status === RefundStatus.Refunded
        ? `${amount} for your ${refund.bookingType} booking has been refunded to your card.`
        : `The refund of ${amount} for your ${refund.bookingType} booking failed. Please contact support.`,
    );
  }

  // Stripe statuses: pending, requires_action, succeeded, failed, canceled.
  private applyStripeStatus(
    refund: RefundDocument,
    stripeRefund: Stripe.Refund,
  ) {
    if (stripeRefund.status === 'succeeded') {
      refund.status = RefundStatus.Refunded;
      refund.failureReason = undefined;
    } else if (
      stripeRefund.status === 'failed' ||
      stripeRefund.status === 'canceled'
    ) {
      refund.status = RefundStatus.Failed;
      refund.failureReason = stripeRefund.failure_reason ?? stripeRefund.status;
    } else {
      refund.status = RefundStatus.Pending;
    }
  }

  private toResponse(refund: RefundDocument): RefundResponse {
    return {
      id: refund._id.toString(),
      bookingType: refund.bookingType,
      bookingId: refund.bookingId.toString(),
      paymentId: refund.paymentId.toString(),
      amount: refund.amount,
      currency: refund.currency,
      refundPercentage: refund.refundPercentage,
      tierDaysBefore: refund.tierDaysBefore ?? null,
      reason: refund.reason,
      status: refund.status,
      stripeRefundId: refund.stripeRefundId ?? null,
      failureReason: refund.failureReason ?? null,
      createdAt: refund.createdAt,
      updatedAt: refund.updatedAt,
    };
  }
}

// Whole cents, rounded down so the refund never exceeds the percentage. Rounding to 6 decimals
// first removes floating-point noise: 25000 * 33.3 / 100 is 8324.999999999998 in JavaScript,
// which must give 8325, not 8324.
export function percentOfCents(
  amountCents: number,
  percentage: number,
): number {
  return Math.floor(Number(((amountCents * percentage) / 100).toFixed(6)));
}
