// TODO(AREA-5): PLACEHOLDER until Area 5's airport schema is merged. Replace this schema and delete this file.
// Requirements: FLT-02, FLT-11, GEN-06.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AirportDocument = HydratedDocument<Airport>;

@Schema({ timestamps: true })
export class Airport {
  // The reference-data seed uses each official IATA code as the airport document _id.
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({
    required: true,
    uppercase: true,
    minlength: 3,
    maxlength: 3,
    unique: true,
  })
  iataCode: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  city: string;

  @Prop({ required: true, trim: true })
  country: string;

  @Prop({ required: true, trim: true })
  timeZone: string;
}

export const AirportSchema = SchemaFactory.createForClass(Airport);
