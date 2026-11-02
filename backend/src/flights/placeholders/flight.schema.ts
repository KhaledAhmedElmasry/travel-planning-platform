// TODO(AREA-5): PLACEHOLDER until Area 5's flight schema is merged. Replace this schema and delete this file.
// Requirements: FLT-03, FLT-04, FLT-11, FLT-22.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export const FLIGHT_STATUSES = ['Scheduled', 'Cancelled', 'Departed'] as const;
export const CABIN_CATEGORIES = [
  'Economy',
  'Premium Economy',
  'Business',
  'First',
] as const;

export type FlightDocument = HydratedDocument<Flight>;
export type FlightStatus = (typeof FLIGHT_STATUSES)[number];
export type CabinCategory = (typeof CABIN_CATEGORIES)[number];

@Schema({ _id: false })
export class FlightCabin {
  @Prop({ type: String, enum: CABIN_CATEGORIES, required: true })
  category: CabinCategory;

  @Prop({ required: true, min: 0, validate: Number.isInteger })
  seatCount: number;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, min: 0 })
  freeBags: number;

  @Prop({ required: true, min: 0 })
  maxBagWeightKg: number;
}
export const FlightCabinSchema = SchemaFactory.createForClass(FlightCabin);

@Schema({ timestamps: true })
export class Flight {
  @Prop({ required: true, trim: true })
  flightNumber: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Airline',
    required: true,
  })
  airline: Types.ObjectId;

  @Prop({
    type: String,
    ref: 'Airport',
    required: true,
  })
  departureAirport: string;

  @Prop({
    type: String,
    ref: 'Airport',
    required: true,
  })
  arrivalAirport: string;

  @Prop({ required: true, type: Date })
  departureUtc: Date;

  @Prop({ required: true, type: Date })
  arrivalUtc: Date;

  @Prop({ type: String, enum: FLIGHT_STATUSES, required: true })
  status: FlightStatus;

  @Prop({ type: [FlightCabinSchema], default: [] })
  cabins: FlightCabin[];
}

export const FlightSchema = SchemaFactory.createForClass(Flight);
FlightSchema.index({
  departureAirport: 1,
  arrivalAirport: 1,
  status: 1,
  departureUtc: 1,
});
