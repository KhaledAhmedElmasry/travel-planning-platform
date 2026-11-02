// TODO(AREA-5): PLACEHOLDER until Area 5 airline schema is merged. Replace this schema and delete this file.
// Requirement: FLT-12.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AirlineDocument = HydratedDocument<Airline>;

@Schema({ collection: 'airlines' })
export class Airline {
  @Prop({ required: true })
  name: string;

  @Prop({ type: String, default: null })
  logoUrl: string | null;

  @Prop({ required: true, default: false })
  isActive: boolean;
}

export const AirlineSchema = SchemaFactory.createForClass(Airline);
