import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectConnection } from '@nestjs/mongoose';
import { ClientSession, Connection, Types } from 'mongoose';
import Stripe from 'stripe';
import { BookingType } from '../common/enums';
import { platformCurrency } from './platform-currency';
import { STRIPE_CLIENT } from './stripe.provider';

// Area: Payments & Refunds
// FLT-27 (bonus): the money side of changing a flight of a Confirmed booking.
//
// The rest of the payments code relies on ONE PaymentIntent per booking and ONE refund per
// payment (a cancellation refunds a percentage of that payment). A fare change keeps that true:
//   - a HIGHER fare: the new total is charged on a NEW PaymentIntent (confirmed at once with the
//     user's payment method), the booking's payment record is switched to it, and the old
//     PaymentIntent is refunded in full. The user's net cost is the fare difference.
//   - a LOWER fare: the difference is refunded on the same PaymentIntent and the payment
//     record's amount is reduced by it.
// So after any change `payments.amount` is again exactly what the booking's cancellation refund
// is calculated on.
//
// Every Stripe refund caused by a change is first written to the `fare_change_refunds`
// collection INSIDE the same database transaction that changes the booking, then sent to Stripe
// and retried every minute until it works (the same idea as the owed refunds of cancellations).
// If the charge succeeded but the change could not be saved, the new charge is refunded the same
// way (kind 'compensation').

export type FareChangeRefundKind = 'old_intent' | 'difference' | 'compensation';
export type FareChangeRefundState = 'pending' | 'refunded' | 'failed' | 'void';

export interface FareChangeRefund {
  _id: Types.ObjectId;
  changeId: string;
  bookingType: BookingType;
  bookingId: Types.ObjectId;
  userId: Types.ObjectId;
  kind: FareChangeRefundKind;
  paymentIntentId: string;
  amount: number;
  currency: string;
  state: FareChangeRefundState;
  stripeRefundId?: string;
  failureReason?: string;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION = 'fare_change_refunds';
const MAX_ATTEMPTS = 20;

@Injectable()
export class FareChangeService {
  private readonly logger = new Logger(FareChangeService.name);

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly config: ConfigService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  private owed() {
    return this.connection.collection<FareChangeRefund>(COLLECTION);
  }

  // Charges `amount` (cents) on a new PaymentIntent with the given payment method, confirmed
  // immediately. Resolves only when Stripe says it succeeded; nothing is charged otherwise.
  async charge(input: {
    bookingType: BookingType;
    bookingId: string;
    userId: string;
    amount: number;
    paymentMethodId: string;
    changeId: string;
  }): Promise<{ paymentIntentId: string }> {
    const currency = platformCurrency(this.config);
    let intent: Stripe.PaymentIntent;
    try {
      intent = await this.stripe.paymentIntents.create(
        {
          amount: input.amount,
          currency: currency.toLowerCase(),
          payment_method: input.paymentMethodId,
          confirm: true,
          // Cards only, no redirects: the payment must finish in this request.
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: 'never',
          },
          metadata: {
            purpose: 'fare_change',
            changeId: input.changeId,
            bookingType: input.bookingType,
            bookingId: input.bookingId,
            userId: input.userId,
          },
        },
        { idempotencyKey: `fare-change-charge-${input.changeId}` },
      );
    } catch (error) {
      throw this.toHttpError(error);
    }
    if (intent.status !== 'succeeded') {
      try {
        await this.stripe.paymentIntents.cancel(intent.id);
      } catch {
        // Already final: nothing was charged by an unfinished intent.
      }
      throw new HttpException(
        'The payment of the fare difference was not completed. Use a card that does not need extra authentication.',
        402,
      );
    }
    return { paymentIntentId: intent.id };
  }

  // Writes a refund that is owed because of a change. Call it with the transaction session so it
  // exists if and only if the change was saved.
  async owe(
    input: Omit<
      FareChangeRefund,
      '_id' | 'state' | 'attempts' | 'createdAt' | 'updatedAt'
    >,
    session?: ClientSession,
  ): Promise<void> {
    const now = new Date();
    await this.owed().insertOne(
      {
        _id: new Types.ObjectId(),
        ...input,
        state: 'pending',
        attempts: 0,
        createdAt: now,
        updatedAt: now,
      },
      { session },
    );
  }

  // The change was saved, so its 'compensation' refund (of the new charge) is not needed.
  async voidCompensation(
    changeId: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.owed().updateOne(
      { changeId, kind: 'compensation', state: 'pending' },
      { $set: { state: 'void', updatedAt: new Date() } },
      { session },
    );
  }

  // Sends the pending refunds of one change to Stripe now (errors are kept for the retry job).
  async processChange(changeId: string): Promise<void> {
    const pending = await this.owed()
      .find({ changeId, state: { $in: ['pending', 'failed'] } })
      .toArray();
    for (const refund of pending) await this.send(refund);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async retryPending(): Promise<number> {
    const due = await this.owed()
      .find({
        state: { $in: ['pending', 'failed'] },
        attempts: { $lt: MAX_ATTEMPTS },
        updatedAt: { $lt: new Date(Date.now() - 20 * 1000) },
      })
      .limit(50)
      .toArray();
    for (const refund of due) await this.send(refund);
    return due.length;
  }

  private async send(refund: FareChangeRefund): Promise<void> {
    try {
      const stripeRefund = await this.stripe.refunds.create(
        {
          payment_intent: refund.paymentIntentId,
          amount: refund.amount,
          metadata: {
            purpose: 'fare_change',
            changeId: refund.changeId,
            kind: refund.kind,
            bookingId: refund.bookingId.toString(),
          },
        },
        { idempotencyKey: `fare-change-refund-${refund._id.toString()}` },
      );
      await this.owed().updateOne(
        { _id: refund._id },
        {
          $set: {
            state: 'refunded',
            stripeRefundId: stripeRefund.id,
            updatedAt: new Date(),
          },
          $unset: { failureReason: '' },
          $inc: { attempts: 1 },
        },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'The refund failed.';
      this.logger.error(
        `Fare change refund ${refund._id.toString()} (${refund.kind}) failed: ${message}`,
      );
      await this.owed().updateOne(
        { _id: refund._id },
        {
          $set: {
            state: 'failed',
            failureReason: message,
            updatedAt: new Date(),
          },
          $inc: { attempts: 1 },
        },
      );
    }
  }

  private toHttpError(error: unknown): Error {
    if (error instanceof Stripe.errors.StripeCardError) {
      return new HttpException(`Your card was declined: ${error.message}`, 402);
    }
    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      return new BadRequestException(error.message);
    }
    if (error instanceof Stripe.errors.StripeError) {
      this.logger.error(`Stripe error: ${error.message}`);
      return new BadGatewayException(
        'The payment provider is not available. Try again later.',
      );
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
