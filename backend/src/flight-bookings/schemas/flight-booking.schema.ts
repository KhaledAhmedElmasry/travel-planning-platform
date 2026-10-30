import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { BookingStatus, CabinClass, PassengerType } from '../../common/enums';
import {
  PendingRefund,
  PendingRefundSchema,
} from '../../payments/schemas/pending-refund.schema';

// Area: Payments, Holds & Booking Engine
// Flight Booking and Passenger (PDF section 5 "Flight Bookings"): FLT-12, FLT-19, FLT-22, FLT-23,
// FLT-26, GEN-11, NEW-01, NEW-02, PAY-01, PAY-02.
// The flight details and prices are copied into the booking when it is created (a snapshot), so
// the e-ticket and cancellation rules can be applied from the booking alone. NEW-02: later PRICE
// changes do not change an existing booking, but TIME changes do: FLT-05 (Area 5) must update the
// copied departureAt / arrivalAt in the same transaction (see flights/schemas/flight.schema.ts).
//
// Bonus FLT-27 / FLT-28: changed flight history and seat numbers per passenger.

@Schema({ _id: false })
export class AirportSnapshot {
  // Official airport code (e.g. CAI), the airport's _id in the reference data.
  @Prop({ required: true })
  code: string;

  // IANA time zone (e.g. Africa/Cairo), used to show local times (FLT-02, GEN-06).
  @Prop({ required: true })
  timeZone: string;
}
const AirportSnapshotSchema = SchemaFactory.createForClass(AirportSnapshot);

// One flight of the booking: one for one-way, two for a round trip (outbound first, FLT-12).
@Schema({ _id: false })
export class BookedSegment {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  flightId: Types.ObjectId;

  @Prop({ required: true })
  flightNumber: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  airlineId: Types.ObjectId;

  @Prop({ required: true })
  airlineName: string;

  @Prop({ type: String, enum: CabinClass, required: true })
  cabinClass: CabinClass;

  @Prop({ type: AirportSnapshotSchema, required: true })
  departureAirport: AirportSnapshot;

  @Prop({ type: AirportSnapshotSchema, required: true })
  arrivalAirport: AirportSnapshot;

  // Stored in UTC (FLT-03).
  @Prop({ required: true })
  departureAt: Date;

  @Prop({ required: true })
  arrivalAt: Date;

  // Cabin fare per seat at booking time, integer cents (NEW-02).
  @Prop({ required: true, min: 0, validate: Number.isInteger })
  fare: number;

  // The cabin's free baggage allowance at booking time (FLT-04), shown on the e-ticket.
  @Prop({ required: true, min: 0 })
  freeBags: number;

  @Prop({ required: true, min: 0 })
  maxBagWeightKg: number;
}
const BookedSegmentSchema = SchemaFactory.createForClass(BookedSegment);

@Schema({ _id: false })
export class ExtraBag {
  @Prop({ required: true, min: 0 })
  weightKg: number;
}
const ExtraBagSchema = SchemaFactory.createForClass(ExtraBag);

@Schema({ _id: false })
export class BookedPassenger {
  @Prop({ type: String, enum: PassengerType, required: true })
  type: PassengerType;

  @Prop({ required: true, trim: true })
  fullName: string;

  // YYYY-MM-DD (a calendar date, so it is stored as text and never shifted by time zones).
  @Prop({ required: true })
  dateOfBirth: string;

  @Prop({ required: true, trim: true })
  passportNumber: string;

  @Prop({ type: [ExtraBagSchema], default: [] })
  extraBags: ExtraBag[];

  // What this passenger pays for all segments, integer cents (infants pay 10%, FLT-12).
  @Prop({ required: true, min: 0, validate: Number.isInteger })
  fare: number;

  // Fees for this passenger's extra bags, integer cents (FLT-08, FLT-19).
  @Prop({ required: true, min: 0, validate: Number.isInteger })
  baggageFee: number;
}
const BookedPassengerSchema = SchemaFactory.createForClass(BookedPassenger);

export type FlightBookingDocument = HydratedDocument<FlightBooking>;

@Schema({ timestamps: true })
export class FlightBooking {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  // GEN-11: pending_payment -> confirmed -> completed, pending_payment -> expired,
  // confirmed -> cancelled. Every change is a conditional update on the current status.
  @Prop({
    type: String,
    enum: BookingStatus,
    required: true,
    default: BookingStatus.PendingPayment,
  })
  status: BookingStatus;

  @Prop({
    type: [BookedSegmentSchema],
    required: true,
    validate: (segments: unknown[]) =>
      segments.length >= 1 && segments.length <= 2,
  })
  segments: BookedSegment[];

  @Prop({ type: [BookedPassengerSchema], required: true })
  passengers: BookedPassenger[];

  // Seats held / booked on every segment: adults + children (infants take no seat, FLT-12).
  @Prop({ required: true, min: 1, validate: Number.isInteger })
  seats: number;

  // Integer cents of the platform currency (PAY-04, NEW-04).
  @Prop({ required: true, min: 1, validate: Number.isInteger })
  totalAmount: number;

  @Prop({ required: true, uppercase: true, minlength: 3, maxlength: 3 })
  currency: string;

  // End of the 10-minute seat hold (FLT-22, NEW-01).
  @Prop({ required: true })
  holdExpiresAt: Date;

  // PAY-02: when the user accepted the airline's policies.
  @Prop({ type: Date, default: null })
  policiesAcceptedAt: Date | null;

  // PAY-01: the payment that confirmed the booking.
  @Prop({ type: MongooseSchema.Types.ObjectId, default: null })
  paymentId: Types.ObjectId | null;

  // FLT-23: unique booking reference, set on confirmation.
  @Prop({ unique: true, sparse: true })
  reference?: string;

  // Time of each status change (NEW-01).
  @Prop({ type: Date, default: null })
  confirmedAt: Date | null;

  @Prop({ type: Date, default: null })
  expiredAt: Date | null;

  @Prop({ type: Date, default: null })
  cancelledAt: Date | null;

  // GEN-11: set when the last flight has departed (NEW-01 job).
  @Prop({ type: Date, default: null })
  completedAt: Date | null;

  // Set only between a cancellation and its refund (PAY-03, see PendingRefund).
  @Prop({ type: PendingRefundSchema, default: null })
  pendingRefund: PendingRefund | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const FlightBookingSchema = SchemaFactory.createForClass(FlightBooking);

// Finds the holds to expire quickly (NEW-01 job).
FlightBookingSchema.index({ status: 1, holdExpiresAt: 1 });
