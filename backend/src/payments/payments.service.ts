import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import Stripe from 'stripe';
import { BookingStatus, BookingType } from '../common/enums';
import { BookingGateway } from './booking-gateway.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RetryPaymentDto } from './dto/retry-payment.dto';
import { PayableBooking } from './interfaces/payable-booking.interface';
import { isDuplicateKeyError } from './is-duplicate-key-error';
import { platformCurrency } from './platform-currency';
import { RefundsService } from './refunds.service';
import {
  Payment,
  PaymentDocument,
  PaymentStatus,
} from './schemas/payment.schema';
import { RefundReason } from './schemas/refund.schema';
import { STRIPE_CLIENT } from './stripe.provider';

// Area: Payments & Refunds
// Business logic and database access for: PAY-01, PAY-02, PAY-03, PAY-04
//
// PAY-01 status: done here. Flights and hotels are connected (FLT-22, FLT-23:
// flight-bookings.service.ts; HTL-17, HTL-18: hotel-bookings.service.ts), and both hold-expiry
// jobs (flight-booking-lifecycle.service.ts, hotel-booking-lifecycle.service.ts) call
// cancelPaymentForBooking().
//   - PAY-02: policies.service.ts sets policiesAcceptedAt through the booking services; the
//     check in loadPayableBooking() refuses payment without it.
//   - PAY-03: refunds go through RefundsService (refunds.service.ts).
//   - GEN-01: confirmPaidBooking() of each booking service sends the in-app notification
//     (FLT-23, HTL-17); refunds notify in refunds.service.ts.

export interface PaymentResponse {
  id: string;
  bookingType: BookingType;
  bookingId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  stripePaymentId: string;
  failureMessage: string | null;
  // Only returned by create and retry: the frontend confirms the payment with Stripe Elements.
  clientSecret?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly config: ConfigService,
    private readonly bookings: BookingGateway,
    private readonly refunds: RefundsService,
  ) {}

  // POST /api/payments (PAY-01)
  async createPayment(
    userId: string,
    dto: CreatePaymentDto,
  ): Promise<PaymentResponse> {
    const booking = await this.loadPayableBooking(
      userId,
      dto.bookingType,
      dto.bookingId,
    );

    const existing = await this.paymentModel.findOne({
      bookingType: dto.bookingType,
      bookingId: dto.bookingId,
    });
    if (existing) {
      if (existing.status === PaymentStatus.Succeeded) {
        throw new ConflictException('This booking is already paid.');
      }
      if (existing.status === PaymentStatus.Failed) {
        throw new ConflictException(
          `The last payment for this booking failed. Retry it with POST /api/payments/${existing._id.toString()}/retry.`,
        );
      }
      if (existing.status === PaymentStatus.Cancelled) {
        throw new ConflictException(
          'The payment for this booking was cancelled.',
        );
      }
      // Still pending (e.g. the page was reloaded): continue with the same PaymentIntent.
      return this.attempt(existing, dto.paymentMethodId);
    }

    const currency = platformCurrency(this.config);
    const intent = await this.callStripe(() =>
      this.stripe.paymentIntents.create(
        {
          amount: booking.totalAmount,
          currency: currency.toLowerCase(),
          // Cards only, no redirect-based methods, so the backend can confirm with a test
          // payment method from Swagger.
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: 'never',
          },
          metadata: {
            bookingType: dto.bookingType,
            bookingId: dto.bookingId,
            userId,
          },
        },
        // The same booking always gets the same PaymentIntent, even if two requests race.
        { idempotencyKey: `payment-${dto.bookingType}-${dto.bookingId}` },
      ),
    );

    let payment: PaymentDocument;
    try {
      payment = await this.paymentModel.create({
        bookingType: dto.bookingType,
        bookingId: dto.bookingId,
        userId,
        stripePaymentIntentId: intent.id,
        amount: intent.amount,
        currency,
        status: PaymentStatus.Pending,
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new ConflictException(
          'A payment for this booking is already being created. Try again.',
        );
      }
      throw err;
    }

    return this.attempt(payment, dto.paymentMethodId, intent);
  }

  // POST /api/payments/:id/retry (PAY-01): retry a failed payment while the hold is valid.
  async retryPayment(
    userId: string,
    paymentId: string,
    dto: RetryPaymentDto,
  ): Promise<PaymentResponse> {
    const payment = await this.findOwnedPayment(userId, paymentId);
    if (payment.status !== PaymentStatus.Failed) {
      throw new ConflictException(
        `Only a failed payment can be retried; this payment is ${payment.status}.`,
      );
    }
    await this.loadPayableBooking(
      userId,
      payment.bookingType,
      payment.bookingId.toString(),
    );

    payment.status = PaymentStatus.Pending;
    payment.failureMessage = undefined;
    await payment.save();

    return this.attempt(payment, dto.paymentMethodId);
  }

  // GET /api/payments/:id (PAY-01)
  async getPayment(
    userId: string,
    paymentId: string,
  ): Promise<PaymentResponse> {
    return this.toResponse(await this.findOwnedPayment(userId, paymentId));
  }

  // POST /api/payments/webhook (PAY-01). Only a verified Stripe event changes a booking.
  async handleWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): Promise<{ received: true }> {
    if (!rawBody || !signature) {
      throw new BadRequestException(
        'Missing Stripe signature or request body.',
      );
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET'),
      );
    } catch {
      throw new BadRequestException('Invalid Stripe signature.');
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.onPaymentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await this.onPaymentFailed(event.data.object);
        break;
      case 'payment_intent.canceled':
        await this.onPaymentCanceled(event.data.object);
        break;
      case 'refund.created':
      case 'refund.updated':
      case 'refund.failed':
        await this.refunds.onStripeRefundEvent(event.data.object);
        break;
      default:
        break;
    }
    return { received: true };
  }

  // Called by the hold-expiry cron (GEN-11) when it expires a pending_payment booking:
  // cancels the PaymentIntent so it can no longer be paid (PAY-01).
  // Used by FlightBookingLifecycleService.expireHolds and HotelBookingLifecycleService.expireHolds.
  async cancelPaymentForBooking(
    bookingType: BookingType,
    bookingId: string,
  ): Promise<void> {
    const payment = await this.paymentModel.findOne({
      bookingType,
      bookingId,
      status: { $in: [PaymentStatus.Pending, PaymentStatus.Failed] },
    });
    if (!payment) return;

    try {
      await this.stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
    } catch (err) {
      if (err instanceof Stripe.errors.StripeInvalidRequestError) {
        // Not cancelable any more: it succeeded meanwhile. The succeeded webhook will find
        // the booking expired and refund the payment.
        this.logger.warn(
          `Could not cancel ${payment.stripePaymentIntentId}: ${err.message}`,
        );
        return;
      }
      throw err;
    }
    payment.status = PaymentStatus.Cancelled;
    await payment.save();
  }

  // --- Webhook handlers ---

  private async onPaymentSucceeded(intent: Stripe.PaymentIntent) {
    const payment = await this.paymentModel.findOne({
      stripePaymentIntentId: intent.id,
    });
    if (!payment) {
      // E.g. an event from `stripe trigger`, not created by this platform.
      this.logger.warn(
        `Ignoring succeeded PaymentIntent ${intent.id}: no payment record.`,
      );
      return;
    }
    if (
      intent.amount !== payment.amount ||
      intent.currency !== payment.currency.toLowerCase()
    ) {
      this.logger.error(
        `PaymentIntent ${intent.id} amount/currency does not match payment ${payment._id.toString()}; booking not confirmed.`,
      );
      return;
    }

    payment.status = PaymentStatus.Succeeded;
    payment.failureMessage = undefined;
    await payment.save();

    // Throws if the booking side is not available, so Stripe sends the event again later.
    const result = await this.bookings
      .handlerFor(payment.bookingType)
      .confirmPaidBooking(payment.bookingId.toString(), payment._id.toString());
    if (result === 'not_confirmable') {
      await this.refundLatePayment(payment);
    }
  }

  private async onPaymentFailed(intent: Stripe.PaymentIntent) {
    const payment = await this.paymentModel.findOne({
      stripePaymentIntentId: intent.id,
    });
    if (!payment || payment.status !== PaymentStatus.Pending) return;

    payment.status = PaymentStatus.Failed;
    payment.failureMessage =
      intent.last_payment_error?.message ?? 'The payment failed.';
    await payment.save();
  }

  private async onPaymentCanceled(intent: Stripe.PaymentIntent) {
    const payment = await this.paymentModel.findOne({
      stripePaymentIntentId: intent.id,
    });
    if (!payment || payment.status === PaymentStatus.Succeeded) return;

    payment.status = PaymentStatus.Cancelled;
    await payment.save();
  }

  // The payment succeeded but the booking can no longer be confirmed (its hold expired):
  // give the money back (openapi.yaml, POST /api/payments/webhook).
  private async refundLatePayment(payment: PaymentDocument) {
    await this.refunds.refundBooking({
      bookingType: payment.bookingType,
      bookingId: payment.bookingId.toString(),
      refundPercentage: 100,
      reason: RefundReason.HoldExpired,
    });
    this.logger.warn(
      `Payment ${payment._id.toString()} succeeded after its booking expired; it was refunded.`,
    );
  }

  // --- Helpers ---

  // Confirms the PaymentIntent with a test payment method (Swagger), or only returns the
  // clientSecret for Stripe Elements (frontend). Success is recorded only by the webhook.
  private async attempt(
    payment: PaymentDocument,
    paymentMethodId?: string,
    intent?: Stripe.PaymentIntent,
  ): Promise<PaymentResponse> {
    let current =
      intent ??
      (await this.callStripe(() =>
        this.stripe.paymentIntents.retrieve(payment.stripePaymentIntentId),
      ));

    if (paymentMethodId) {
      try {
        current = await this.stripe.paymentIntents.confirm(current.id, {
          payment_method: paymentMethodId,
        });
      } catch (err) {
        if (err instanceof Stripe.errors.StripeCardError) {
          payment.status = PaymentStatus.Failed;
          payment.failureMessage = err.message;
          await payment.save();
          return this.toResponse(payment, current.client_secret);
        }
        throw this.toHttpError(err);
      }
    }

    return this.toResponse(payment, current.client_secret);
  }

  // Ownership, status, hold and policy checks before any payment (PAY-01, PAY-02, GEN-11).
  private async loadPayableBooking(
    userId: string,
    bookingType: BookingType,
    bookingId: string,
  ): Promise<PayableBooking> {
    const booking = await this.bookings.findOwnedBooking(
      userId,
      bookingType,
      bookingId,
    );
    if (booking.status !== BookingStatus.PendingPayment) {
      throw new ConflictException(
        `This booking is ${booking.status}, not pending payment.`,
      );
    }
    if (booking.holdExpiresAt.getTime() <= Date.now()) {
      throw new ConflictException(
        'The hold on this booking has expired. Please book again.',
      );
    }
    if (!booking.policiesAcceptedAt) {
      throw new BadRequestException(
        'Accept the provider policies before paying (PAY-02).',
      );
    }
    if (booking.currency.toUpperCase() !== platformCurrency(this.config)) {
      // Should never happen: every booking is priced in the platform currency (PAY-04).
      throw new ConflictException(
        'The booking is not priced in the platform currency.',
      );
    }
    return booking;
  }

  private async findOwnedPayment(
    userId: string,
    paymentId: string,
  ): Promise<PaymentDocument> {
    const payment = isValidObjectId(paymentId)
      ? await this.paymentModel.findOne({ _id: paymentId, userId })
      : null;
    if (!payment) throw new NotFoundException('Payment not found.');
    return payment;
  }

  private async callStripe<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (err) {
      throw this.toHttpError(err);
    }
  }

  private toHttpError(err: unknown): Error {
    if (err instanceof Stripe.errors.StripeInvalidRequestError) {
      return new BadRequestException(err.message);
    }
    if (err instanceof Stripe.errors.StripeError) {
      this.logger.error(`Stripe error: ${err.message}`);
      return new BadGatewayException(
        'The payment provider is not available. Try again later.',
      );
    }
    return err instanceof Error ? err : new Error(String(err));
  }

  private toResponse(
    payment: PaymentDocument,
    clientSecret?: string | null,
  ): PaymentResponse {
    return {
      id: payment._id.toString(),
      bookingType: payment.bookingType,
      bookingId: payment.bookingId.toString(),
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      stripePaymentId: payment.stripePaymentIntentId,
      failureMessage: payment.failureMessage ?? null,
      ...(clientSecret !== undefined && { clientSecret }),
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}
