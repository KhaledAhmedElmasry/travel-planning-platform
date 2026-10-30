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
import { FlightBookingsService } from '../flight-bookings/flight-bookings.service';
import { HotelBookingsService } from '../hotel-bookings/hotel-bookings.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RetryPaymentDto } from './dto/retry-payment.dto';
import {
  BookingPaymentHandler,
  PayableBooking,
} from './interfaces/payable-booking.interface';
import {
  Payment,
  PaymentDocument,
  PaymentStatus,
} from './schemas/payment.schema';
import { STRIPE_CLIENT } from './stripe.provider';

// Area: Payments & Refunds
// Business logic and database access for: PAY-01, PAY-02, PAY-03, PAY-04, NEW-04
//
// PAY-01 status: done here, but it cannot run end to end until these are merged:
//   - FLT-22 / HTL-18 (this area): FlightBookingsService and HotelBookingsService must implement
//     findPayableBooking() and confirmPaidBooking(). Until then every payment for a booking
//     returns 501. See the TODOs in flight-bookings.service.ts and hotel-bookings.service.ts.
//   - NEW-01 (this area): the hold-expiry cron must call cancelPaymentForBooking() when it
//     expires a booking, so the PaymentIntent is cancelled (PAY-01).
//   - PAY-02 (this area): the policies endpoints set policiesAcceptedAt on the booking; the check
//     in loadPayableBooking() already refuses payment without it.
//   - PAY-03 (this area): refundLatePayment() issues the Stripe refund but does not yet store a
//     Refund document (refund.schema.ts is still a placeholder).
//   - GEN-01 (Area 3): no in-app notification is sent on confirmation yet. Call
//     NotificationsService from confirmPaidBooking() (FLT-23, HTL-17) once it exists.

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
    private readonly flightBookings: FlightBookingsService,
    private readonly hotelBookings: HotelBookingsService,
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

    const currency = this.platformCurrency();
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
      // TODO(PAY-03): handle refund events (e.g. refund.updated) to update the Refund status.
      default:
        break;
    }
    return { received: true };
  }

  // Called by the hold-expiry cron (NEW-01) when it expires a pending_payment booking:
  // cancels the PaymentIntent so it can no longer be paid (PAY-01).
  // TODO(NEW-01): call this from the cron in FlightBookingsService / HotelBookingsService.
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
    const result = await this.handlerFor(
      payment.bookingType,
    ).confirmPaidBooking(payment.bookingId.toString(), payment._id.toString());
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
    await this.stripe.refunds.create(
      { payment_intent: payment.stripePaymentIntentId },
      {
        idempotencyKey: `late-payment-refund-${payment.stripePaymentIntentId}`,
      },
    );
    this.logger.warn(
      `Payment ${payment._id.toString()} succeeded after its booking expired; it was refunded.`,
    );
    // TODO(PAY-03): store a Refund document (100%, reason "hold expired") so the user can see it
    // with GET /api/refunds/:id, and notify the user (GEN-01).
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

  // Ownership, status, hold and policy checks before any payment (PAY-01, PAY-02, NEW-01).
  private async loadPayableBooking(
    userId: string,
    bookingType: BookingType,
    bookingId: string,
  ): Promise<PayableBooking> {
    const booking = isValidObjectId(bookingId)
      ? await this.handlerFor(bookingType).findPayableBooking(bookingId)
      : null;
    // Another user's booking is reported as not found (ACC-11).
    if (!booking || booking.userId !== userId) {
      throw new NotFoundException('Booking not found.');
    }
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
    if (booking.currency.toUpperCase() !== this.platformCurrency()) {
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

  private handlerFor(bookingType: BookingType): BookingPaymentHandler {
    return bookingType === BookingType.Flight
      ? this.flightBookings
      : this.hotelBookings;
  }

  private platformCurrency(): string {
    return this.config.get<string>('PLATFORM_CURRENCY', 'USD').toUpperCase();
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

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}
