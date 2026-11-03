// TODO(AREA-5): Replace with the shared airport schema when it is available.
// Requirement: FLT-12.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AirportDocument = HydratedDocument<Airport>;

@Schema({ collection: 'airports', _id: false })
export class Airport {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true, unique: true, uppercase: true })
  iataCode: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  cityId: string;

  @Prop({ required: true })
  countryCode: string;

  @Prop({ required: true })
  timeZone: string;
}

export const AirportSchema = SchemaFactory.createForClass(Airport);
