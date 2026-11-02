// TODO(AREA-5): PLACEHOLDER until Area 5's airline schema is merged. Replace this schema and delete this file.
// Requirements: FLT-01, FLT-11, ACC-15.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AirlineDocument = HydratedDocument<Airline>;

@Schema({ timestamps: true })
export class Airline {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, default: null })
  logoUrl: string | null;

  @Prop({ required: true, default: true })
  isActive: boolean;
}

export const AirlineSchema = SchemaFactory.createForClass(Airline);
