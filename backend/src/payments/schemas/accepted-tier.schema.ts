import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

// Area: Payments, Holds & Booking Engine
// PAY-02, FLT-26, HTL-21 (PDF 6.4: "Cancellation and refund calculations must follow the policy
// applicable to the booking"): one cancellation tier as the user accepted it before paying. The
// booking keeps a copy of the provider's tiers taken at accept-policies time, so a later change by
// the moderator (FLT-09, HTL-10) does not change the refund of a booking that was already paid.
@Schema({ _id: false })
export class AcceptedTier {
  @Prop({ required: true, min: 0 })
  daysBefore: number;

  @Prop({ required: true, min: 0, max: 100 })
  refundPercentage: number;
}

export const AcceptedTierSchema = SchemaFactory.createForClass(AcceptedTier);
