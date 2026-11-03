import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { CabinClass } from '../../common/enums';

// Area: Airlines & Flight Inventory
// Flight and Cabin Inventory (PDF section 5 "Flights"): airline, airports, times, status,
// cabins with seats and prices. See FLT-03, FLT-04, FLT-30, GEN-06.
//
// - Times are stored in UTC (departureAt, arrivalAt). The request sends local times at each
//   airport; flights/flight-time.ts converts them with the airport's IANA time zone (GEN-06).
// - departureDate is the local departure date (YYYY-MM-DD) at the departure airport. The unique
//   index { airlineId, flightNumber, departureDate } makes the flight number unique per airline
//   per departure date (FLT-03).
// - departureTimeZone / arrivalTimeZone are copied from the airport list (FLT-02) when the flight
//   is created, so local times can be shown without reading the airports again.
//
// AGREED WITH AREA 1 (already used by flight-bookings/seat-inventory.service.ts, FLT-22/23/26):
// the seat hold updates the "flights" collection directly, so the model must be named "Flight"
// (collection "flights") and keep these field names:
//   status:      'scheduled' | 'cancelled' | 'departed'   (FLT-30; only 'scheduled' can be held)
//   departureAt: Date (UTC)                               (a flight that departed cannot be held)
//   cabins: [{ cabinClass: 'economy' | 'premium_economy' | 'business' | 'first',
//              total: number,   // seat count from the request field "seats" (FLT-04)
//              booked: number,  // confirmed seats, starts at 0
//              held: number,    // seats on hold for unpaid bookings, starts at 0
//              price, freeBags, maxBagWeightKg, ... }]
// Never change booked or held outside seat-inventory.service.ts; FLT-05 must not lower total
// below booked + held.
//
// Effect on existing flight bookings (NEW-02), in the same transaction as the flight change
// (every status change filtered with status: { $in: allowedFrom(<new status>) } from
// payments/booking-lifecycle.ts, GEN-11):
//   FLT-05 time change: bookings keep a copy of the times (e-ticket, "before departure" check,
//     refund tier), so update it: FlightBooking.updateMany({ 'segments.flightId': id },
//     { $set: { 'segments.$[s].departureAt': ..., 'segments.$[s].arrivalAt': ... } },
//     { arrayFilters: [{ 's.flightId': id }], session }). Price changes do NOT touch bookings.
//   FLT-06 flight cancelled: do NOT change the bookings yourself; Area 1 does it (done):
//       const result = await connection.transaction(async (session) => {
//         // set this flight's status to 'cancelled' (only if it is 'scheduled'), with { session }
//         return lifecycle.cancelBookingsForFlight(flightId, session);
//       });
//       await lifecycle.finishFlightCancellation(result);  // after the commit
//     (lifecycle = FlightBookingLifecycleService, exported by FlightBookingsModule). Every
//     booking with a segment on this flight changes as a whole (round trips too): confirmed ->
//     cancelled with a 100% refund, pending_payment -> expired, seats released on every segment.
//     result.cancelledBookingIds.length is "the number of bookings that were cancelled" of the
//     response.

// FLT-30: the status of a flight.
export enum FlightStatus {
  Scheduled = 'scheduled',
  Cancelled = 'cancelled',
  Departed = 'departed',
}

// One cabin of a flight (FLT-04). Embedded in the flight; its _id is the cabinId of the API.
@Schema({ _id: true })
export class Cabin {
  _id: Types.ObjectId;

  @Prop({ type: String, enum: CabinClass, required: true })
  cabinClass: CabinClass;

  // Seat counters (FLT-04, FLT-22): free seats = total - booked - held.
  @Prop({ required: true, min: 1 })
  total: number;

  @Prop({ required: true, min: 0, default: 0 })
  booked: number;

  @Prop({ required: true, min: 0, default: 0 })
  held: number;

  // Fare per seat in integer cents of the platform currency (PAY-04).
  @Prop({ required: true, min: 1 })
  price: number;

  // Free baggage allowance per passenger (number of bags).
  @Prop({ required: true, min: 0 })
  freeBags: number;

  // Maximum weight per bag in kg, also for extra bags (FLT-08).
  @Prop({ required: true, min: 0 })
  maxBagWeightKg: number;
}

export const CabinSchema = SchemaFactory.createForClass(Cabin);

export type FlightDocument = HydratedDocument<Flight>;

@Schema({ timestamps: true, collection: 'flights' })
export class Flight {
  // The airline this flight belongs to (the moderator's own airline, FLT-03).
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Airline',
    required: true,
    index: true,
  })
  airlineId: Types.ObjectId;

  // e.g. MS911, stored in upper case.
  @Prop({ required: true, trim: true, uppercase: true })
  flightNumber: string;

  // IATA codes from the airport list (FLT-02), e.g. CAI.
  @Prop({ required: true, uppercase: true, index: true })
  departureAirport: string;

  @Prop({ required: true, uppercase: true, index: true })
  arrivalAirport: string;

  // IANA time zones of the two airports (GEN-06).
  @Prop({ required: true })
  departureTimeZone: string;

  @Prop({ required: true })
  arrivalTimeZone: string;

  // UTC times (GEN-06).
  @Prop({ required: true, index: true })
  departureAt: Date;

  @Prop({ required: true })
  arrivalAt: Date;

  // Local departure date at the departure airport, YYYY-MM-DD (flight number uniqueness).
  @Prop({ required: true })
  departureDate: string;

  @Prop({
    type: String,
    enum: FlightStatus,
    required: true,
    default: FlightStatus.Scheduled,
    index: true,
  })
  status: FlightStatus;

  @Prop({ type: [CabinSchema], default: [] })
  cabins: Types.DocumentArray<Cabin>;

  createdAt?: Date;
  updatedAt?: Date;
}

export const FlightSchema = SchemaFactory.createForClass(Flight);

// FLT-03: a flight number is unique for the airline on the same departure date.
FlightSchema.index(
  { airlineId: 1, flightNumber: 1, departureDate: 1 },
  { unique: true },
);
