// TODO(AREA-5): PLACEHOLDER until Area 5 flight schema is merged. Replace this schema and delete this file.
// Requirement: FLT-12.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export const CABIN_CATEGORIES = [
  'Economy',
  'Premium Economy',
  'Business',
  'First',
] as const;

export type CabinCategory = (typeof CABIN_CATEGORIES)[number];
export type FlightDocument = HydratedDocument<Flight>;

@Schema({ _id: false })
export class FlightCabin {
  @Prop({ type: String, enum: CABIN_CATEGORIES, required: true })
  category: CabinCategory;

  @Prop({ required: true, min: 0 })
  seatCount: number;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, min: 0 })
  freeBags: number;

  @Prop({ required: true, min: 0 })
  maxBagWeightKg: number;
}

export const FlightCabinSchema = SchemaFactory.createForClass(FlightCabin);

@Schema({ collection: 'flights' })
export class Flight {
  @Prop({ required: true })
  flightNumber: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Airline', required: true })
  airline: Types.ObjectId;

  @Prop({ type: String, ref: 'Airport', required: true })
  departureAirport: string;

  @Prop({ type: String, ref: 'Airport', required: true })
  arrivalAirport: string;

  @Prop({ required: true, type: Date })
  departureUtc: Date;

  @Prop({ required: true, type: Date })
  arrivalUtc: Date;

  @Prop({
    required: true,
    enum: ['Scheduled', 'Cancelled', 'Departed'],
    default: 'Scheduled',
  })
  status: string;

  @Prop({ type: [FlightCabinSchema], required: true })
  cabins: FlightCabin[];
}

export const FlightSchema = SchemaFactory.createForClass(Flight);
