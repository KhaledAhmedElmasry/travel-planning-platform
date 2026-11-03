// TODO(AREA-5): Replace with the shared airline schema when it is available.
// Requirements: FLT-12, FLT-17.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AirlineDocument = HydratedDocument<Airline>;

@Schema({ _id: false })
export class AirlineCancellationTier {
  @Prop({ required: true, min: 0 })
  daysBefore: number;

  @Prop({ required: true, min: 0, max: 100 })
  refundPercentage: number;
}

const AirlineCancellationTierSchema = SchemaFactory.createForClass(
  AirlineCancellationTier,
);

@Schema({ collection: 'airlines' })
export class Airline {
  @Prop({ required: true })
  name: string;

  @Prop({ type: String, default: null })
  code: string | null;

  @Prop({ type: String, default: null })
  logoUrl: string | null;

  @Prop({ required: true, default: true })
  active: boolean;

  @Prop({ required: true, default: 0, min: 0 })
  extraBagPrice: number;

  @Prop({ required: true, default: 0, min: 0 })
  maxExtraBagsPerPassenger: number;

  @Prop({ type: [AirlineCancellationTierSchema], default: [] })
  cancellationTiers: AirlineCancellationTier[];
}

export const AirlineSchema = SchemaFactory.createForClass(Airline);
