import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { CabinClass } from '../../common/enums';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type FlightDocument = HydratedDocument<Flight>;
export type FlightStatus = 'scheduled' | 'cancelled' | 'departed';

@Schema({ _id: false })
export class FlightCabin {
  @Prop({ type: String, enum: Object.values(CabinClass), required: true })
  cabinClass: CabinClass;

  @Prop({ required: true, min: 0 })
  total: number;

  @Prop({ required: true, default: 0, min: 0 })
  booked: number;

  @Prop({ required: true, default: 0, min: 0 })
  held: number;

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
  departureAt: Date;

  @Prop({ required: true, type: Date })
  arrivalAt: Date;

  @Prop({
    required: true,
    enum: ['scheduled', 'cancelled', 'departed'],
    default: 'scheduled',
  })
  status: FlightStatus;

  @Prop({ type: [FlightCabinSchema], required: true })
  cabins: FlightCabin[];
}

export const FlightSchema = SchemaFactory.createForClass(Flight);
