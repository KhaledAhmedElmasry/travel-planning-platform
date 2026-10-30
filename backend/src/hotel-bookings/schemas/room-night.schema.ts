import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

// Area: Payments, Holds & Booking Engine
// Requirements: HTL-18 (and HTL-17, HTL-21, NEW-01)
// One document per room and night that is held or booked. The UNIQUE index on (roomId, night)
// means MongoDB itself refuses a second document for the same room and night, so two requests
// can never hold or book the same room on the same night, even at the same moment (PDF 8.6:
// "Hotel bookings must be concurrency-safe").
//   hold (HTL-18): insert the nights as `held` (expiresAt = end of the 10-minute hold);
//   confirm (HTL-17): held -> booked;
//   hold expired (NEW-01) or reservation cancelled (HTL-21): the documents are deleted.
// Area 7 reads it through RoomInventoryService.findTakenNights() (HTL-06, HTL-08, HTL-11, HTL-15).

export enum RoomNightStatus {
  Held = 'held',
  Booked = 'booked',
}

export type RoomNightDocument = HydratedDocument<RoomNight>;

@Schema({ timestamps: true })
export class RoomNight {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  roomId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  hotelId: Types.ObjectId;

  // The date of the night at 00:00 UTC (stay-dates.ts).
  @Prop({ required: true })
  night: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ type: String, enum: RoomNightStatus, required: true })
  status: RoomNightStatus;

  // End of the hold for held nights; null for booked nights. A held night whose hold has ended
  // no longer counts as taken, even before the expiry job deletes it.
  @Prop({ type: Date, default: null })
  expiresAt: Date | null;
}

export const RoomNightSchema = SchemaFactory.createForClass(RoomNight);

RoomNightSchema.index({ roomId: 1, night: 1 }, { unique: true });
