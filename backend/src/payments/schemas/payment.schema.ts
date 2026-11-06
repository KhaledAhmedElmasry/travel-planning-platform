import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { BookingType } from '../../common/enums';

// Area: Payments & Refunds
// Payment (PDF section 5 "Payments"), PAY-01.
// Never store card data: only the Stripe payment id, amount, currency and status (PAY-01).
// One payment per booking: a failed payment is retried on the same Stripe PaymentIntent, so a
// booking can never be charged twice.

export enum PaymentStatus {
  Pending = 'pending',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export type PaymentDocument = HydratedDocument<Payment>;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: String, enum: BookingType, required: true })
  bookingType: BookingType;

  // A flight booking or a hotel booking id, depending on bookingType.
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  bookingId: Types.ObjectId;

  // The user who made the booking; only this user may see or retry the payment.
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  stripePaymentIntentId: string;

  // Integer cents of the platform currency (PAY-04).
  @Prop({ required: true, min: 1, validate: Number.isInteger })
  amount: number;

  @Prop({ required: true, uppercase: true, minlength: 3, maxlength: 3 })
  currency: string;

  @Prop({
    type: String,
    enum: PaymentStatus,
    required: true,
    default: PaymentStatus.Pending,
  })
  status: PaymentStatus;

  // Stripe's reason for the last failed attempt (e.g. "Your card was declined."). Not card data.
  @Prop()
  failureMessage?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.index({ bookingType: 1, bookingId: 1 }, { unique: true });
