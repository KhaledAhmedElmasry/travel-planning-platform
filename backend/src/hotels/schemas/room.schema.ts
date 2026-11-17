import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

// Area: Hotels & Rooms (HTL-03..HTL-06)
// AGREED WITH AREA 1 (read directly from the "rooms" collection by hotel-bookings): the model
// must be named "Room" and keep these field names. Dates are calendar dates stored at
// 00:00 UTC (see hotel-bookings/stay-dates.ts); both ends of a range are INCLUDED.

@Schema({ _id: false })
export class RoomDateRange {
  @Prop({ required: true })
  from: Date;

  @Prop({ required: true })
  to: Date;
}
export const RoomDateRangeSchema = SchemaFactory.createForClass(RoomDateRange);

export type RoomDocument = HydratedDocument<Room>;

@Schema({ timestamps: true })
export class Room {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Hotel', required: true })
  hotelId: Types.ObjectId;

  // Room number or name, unique within the hotel (HTL-03).
  @Prop({ required: true, trim: true, maxlength: 20 })
  roomNumber: string;

  @Prop({ required: true, trim: true, maxlength: 50 })
  type: string;

  @Prop({ required: true, min: 1, validate: Number.isInteger })
  beds: number;

  @Prop({ required: true, min: 1, validate: Number.isInteger })
  maxOccupancy: number;

  // Integer cents of the platform currency, greater than 0 (PAY-04).
  @Prop({ required: true, min: 1, validate: Number.isInteger })
  pricePerNight: number;

  // HTL-06: false = deactivated, cannot be booked.
  @Prop({ default: true })
  active: boolean;

  // HTL-04: the nights the room can be booked.
  @Prop({ type: [RoomDateRangeSchema], default: [] })
  availableRanges: RoomDateRange[];

  // HTL-06: blocked nights.
  @Prop({ type: [RoomDateRangeSchema], default: [] })
  blockedRanges: RoomDateRange[];

  // Written by Area 1 on every hold (keep it in the schema).
  @Prop({ type: Date, default: null })
  lastReservedAt: Date | null;
}

export const RoomSchema = SchemaFactory.createForClass(Room);

// HTL-03: the same room number cannot exist twice in one hotel.
RoomSchema.index({ hotelId: 1, roomNumber: 1 }, { unique: true });
