// TODO(AREA-5): PLACEHOLDER until Area 5 airline schema is merged. Replace this schema and delete this file.
// Requirements: FLT-12, FLT-17.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AirlineDocument = HydratedDocument<Airline>;

@Schema({ _id: false })
export class AirlineBaggagePolicy {
  @Prop({ required: true, min: 0 })
  pricePerExtraBag: number;

  @Prop({ required: true, min: 0 })
  maxExtraBagsPerPassenger: number;
}

const AirlineBaggagePolicySchema =
  SchemaFactory.createForClass(AirlineBaggagePolicy);

@Schema({ _id: false })
export class AirlineCancellationTier {
  @Prop({ required: true, min: 0 })
  daysBeforeDeparture: number;

  @Prop({ required: true, min: 0, max: 100 })
  refundPercentage: number;
}

const AirlineCancellationTierSchema = SchemaFactory.createForClass(
  AirlineCancellationTier,
);

@Schema({ _id: false })
export class AirlineCancellationPolicy {
  @Prop({ type: [AirlineCancellationTierSchema], default: [] })
  tiers: AirlineCancellationTier[];
}

const AirlineCancellationPolicySchema = SchemaFactory.createForClass(
  AirlineCancellationPolicy,
);

@Schema({ collection: 'airlines' })
export class Airline {
  @Prop({ required: true })
  name: string;

  @Prop({ type: String, default: null })
  code: string | null;

  @Prop({ type: String, default: null })
  logoUrl: string | null;

  @Prop({ required: true, default: false })
  isActive: boolean;

  @Prop({ type: AirlineBaggagePolicySchema, default: null })
  baggagePolicy: AirlineBaggagePolicy | null;

  @Prop({ type: AirlineCancellationPolicySchema, default: null })
  cancellationPolicy: AirlineCancellationPolicy | null;
}

export const AirlineSchema = SchemaFactory.createForClass(Airline);
