import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { BookingStatus } from '../../common/enums';
import {
  PendingRefund,
  PendingRefundSchema,
} from '../../payments/schemas/pending-refund.schema';

// Area: Payments, Holds & Booking Engine
// Hotel Booking (PDF section 5 "Hotel Bookings"): HTL-16, HTL-17, HTL-18, HTL-21, GEN-11, NEW-01,
// PAY-01, PAY-02, PAY-03. Read by Area 6 (HTL-20 my reservations, HTL-22 hotel's reservations),
// Area 3 (ACC-17 admin overview) and Area 4 (HTL-23 reviews of Completed stays).
// One reservation = one hotel, the same dates for every room, one payment and one reference.
// The rooms' details and prices are copied in when it is created (a snapshot), so later room or
// price changes do not change it (HTL-05: "Price changes do not affect existing reservations").
// Which room is taken on which night is stored separately, one document per room and night, in
// room-night.schema.ts: its unique index is what makes double booking impossible (HTL-18).

@Schema({ _id: false })
export class BookedRoom {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  roomId: Types.ObjectId;

  @Prop({ required: true })
  roomNumber: string;

  @Prop({ required: true })
  type: string;

  @Prop({ required: true, min: 1 })
  beds: number;

  @Prop({ required: true, min: 1 })
  maxOccupancy: number;

  // HTL-16: the guests assigned to this room. Children are given by age (0-17).
  @Prop({ required: true, min: 0, validate: Number.isInteger })
  adults: number;

  @Prop({ type: [Number], default: [] })
  childrenAges: number[];

  // Price per night at booking time, integer cents of the platform currency (HTL-05, PAY-04).
  @Prop({ required: true, min: 1, validate: Number.isInteger })
  pricePerNight: number;

  // nights x pricePerNight, integer cents.
  @Prop({ required: true, min: 1, validate: Number.isInteger })
  subtotal: number;
}
const BookedRoomSchema = SchemaFactory.createForClass(BookedRoom);

export type HotelBookingDocument = HydratedDocument<HotelBooking>;

@Schema({ timestamps: true })
export class HotelBooking {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  hotelId: Types.ObjectId;

  // The hotel's name at booking time (shown in lists without reading the hotel).
  @Prop({ required: true })
  hotelName: string;

  // Calendar dates stored at 00:00 UTC (stay-dates.ts). checkOut is the departure day.
  @Prop({ required: true })
  checkIn: Date;

  @Prop({ required: true })
  checkOut: Date;

  @Prop({ required: true, min: 1, validate: Number.isInteger })
  nights: number;

  // One or more rooms of this hotel, each at most once (HTL-16).
  @Prop({
    type: [BookedRoomSchema],
    required: true,
    validate: (rooms: unknown[]) => rooms.length >= 1,
  })
  rooms: BookedRoom[];

  // Sum of the rooms' subtotals, integer cents of the platform currency (HTL-16, PAY-04).
  @Prop({ required: true, min: 1, validate: Number.isInteger })
  totalAmount: number;

  @Prop({ required: true, uppercase: true, minlength: 3, maxlength: 3 })
  currency: string;

  // GEN-11: pending_payment -> confirmed -> completed, pending_payment -> expired,
  // confirmed -> cancelled. Every change is a conditional update on the current status.
  @Prop({
    type: String,
    enum: BookingStatus,
    required: true,
    default: BookingStatus.PendingPayment,
  })
  status: BookingStatus;

  // End of the 10-minute hold of all its rooms (HTL-18, NEW-01).
  @Prop({ required: true })
  holdExpiresAt: Date;

  // PAY-02: when the user accepted the hotel's policies.
  @Prop({ type: Date, default: null })
  policiesAcceptedAt: Date | null;

  // PAY-01: the payment that confirmed the reservation.
  @Prop({ type: MongooseSchema.Types.ObjectId, default: null })
  paymentId: Types.ObjectId | null;

  // HTL-17: unique booking reference, set on confirmation.
  @Prop({ unique: true, sparse: true })
  reference?: string;

  // Time of each status change (NEW-01).
  @Prop({ type: Date, default: null })
  confirmedAt: Date | null;

  @Prop({ type: Date, default: null })
  expiredAt: Date | null;

  @Prop({ type: Date, default: null })
  cancelledAt: Date | null;

  // GEN-11: set the day after the check-out date (NEW-01 job); then it can be reviewed (HTL-23).
  @Prop({ type: Date, default: null })
  completedAt: Date | null;

  // Set only between a cancellation and its refund (PAY-03, see PendingRefund).
  @Prop({ type: PendingRefundSchema, default: null })
  pendingRefund: PendingRefund | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const HotelBookingSchema = SchemaFactory.createForClass(HotelBooking);

// Finds the holds to expire quickly (NEW-01 job).
HotelBookingSchema.index({ status: 1, holdExpiresAt: 1 });
// "Has this room ever been reserved?" (HTL-06 delete, Area 7).
HotelBookingSchema.index({ 'rooms.roomId': 1 });
