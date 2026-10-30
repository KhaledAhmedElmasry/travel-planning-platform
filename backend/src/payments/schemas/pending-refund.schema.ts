import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { RefundReason } from './refund.schema';

// Area: Payments, Holds & Booking Engine
// PAY-03: the refund a cancellation still owes, stored on the flight booking (FLT-26) or hotel
// reservation (HTL-21). It is saved in the same transaction as the cancellation and cleared once
// the refund is recorded. If the server stops in between, the every-minute job of the booking
// type creates the refund, so no cancellation is left without its refund.
@Schema({ _id: false })
export class PendingRefund {
  @Prop({ required: true, min: 0, max: 100 })
  refundPercentage: number;

  // daysBefore of the provider tier used, null for 0% or a provider cancellation.
  @Prop({ type: Number, default: null })
  tierDaysBefore: number | null;

  @Prop({ type: String, enum: RefundReason, required: true })
  reason: RefundReason;
}

export const PendingRefundSchema = SchemaFactory.createForClass(PendingRefund);
