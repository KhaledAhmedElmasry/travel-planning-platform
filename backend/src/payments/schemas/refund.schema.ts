import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { BookingType } from '../../common/enums';

// Area: Payments & Refunds
// Refund (PDF section 5 "Payments"), PAY-03: booking, payment, amount, Stripe refund id, status
// and the policy applied. One refund per payment: a booking is cancelled at most once, and a
// payment that arrives after its hold expired is refunded once.

// Shown on the booking details as Pending, Refunded or Failed (PAY-03).
export enum RefundStatus {
  Pending = 'pending',
  Refunded = 'refunded',
  Failed = 'failed',
}

export enum RefundReason {
  // The user cancelled; percentage from the provider's tiers (FLT-26, HTL-21).
  UserCancellation = 'user_cancellation',
  // The airline cancelled the flight; always 100% (FLT-06).
  ProviderCancellation = 'provider_cancellation',
  // Stripe confirmed the payment after the hold had expired; always 100% (PAY-01).
  HoldExpired = 'hold_expired',
}

export type RefundDocument = HydratedDocument<Refund>;

@Schema({ timestamps: true })
export class Refund {
  @Prop({ type: String, enum: BookingType, required: true })
  bookingType: BookingType;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  bookingId: Types.ObjectId;

  // The owner of the booking; only this user may see the refund.
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, unique: true })
  paymentId: Types.ObjectId;

  // Integer cents of the platform currency (PAY-04), at most the amount paid.
  @Prop({ required: true, min: 1, validate: Number.isInteger })
  amount: number;

  @Prop({ required: true, uppercase: true, minlength: 3, maxlength: 3 })
  currency: string;

  // The applied policy: the percentage of the amount paid...
  @Prop({ required: true, min: 0, max: 100 })
  refundPercentage: number;

  // ...and, for a user cancellation, the tier it came from (its daysBefore threshold).
  @Prop({ type: Number, default: null })
  tierDaysBefore: number | null;

  @Prop({ type: String, enum: RefundReason, required: true })
  reason: RefundReason;

  // Set once Stripe accepted the refund request.
  @Prop({ unique: true, sparse: true })
  stripeRefundId?: string;

  @Prop({
    type: String,
    enum: RefundStatus,
    required: true,
    default: RefundStatus.Pending,
  })
  status: RefundStatus;

  // Why the refund failed (Stripe's failure_reason or error message).
  @Prop()
  failureReason?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const RefundSchema = SchemaFactory.createForClass(Refund);
