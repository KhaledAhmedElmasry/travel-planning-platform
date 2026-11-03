import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

// Area: Itineraries
// ITN-01: a user's private itinerary. ITN-05: its ordered days. Activities, budgets, transport,
// cloning and public visibility are added by their own requirements.

// ITN-05: one day of an itinerary. Days are embedded (at most 60, owned by the itinerary), so a
// renumber after add / edit / delete / reorder is saved atomically with one write. number and date
// are always set by renumberDays in ../day-schedule.ts and must never be set anywhere else.
// Area 6 (ITN-09 hotels) reads days in array order with { _id, number, date, cityId }.
@Schema({ _id: true, timestamps: false })
export class ItineraryDay {
  _id: Types.ObjectId;

  // 1-based position; days are always numbered 1..N without gaps.
  @Prop({ type: Number, required: true, min: 1 })
  number: number;

  // Start date + number - 1 days, at midnight UTC.
  @Prop({ type: Date, required: true })
  date: Date;

  // city_id from the predefined city list (NEW-05), e.g. 'cairo'.
  @Prop({ type: String, required: true })
  cityId: string;

  @Prop({ type: String, default: '', maxlength: 1000 })
  notes: string;
}

export const ItineraryDaySchema = SchemaFactory.createForClass(ItineraryDay);

export type ItineraryDocument = HydratedDocument<Itinerary>;

@Schema({ timestamps: true })
export class Itinerary {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 100 })
  title: string;

  // Official country codes from the predefined reference data (NEW-05).
  @Prop({ type: [String], required: true })
  countryCodes: string[];

  // Stored at midnight UTC; the API exposes it as an ISO calendar date.
  @Prop({ type: Date, required: true })
  startDate: Date;

  // ITN-01: every newly-created itinerary is private. ITN-20 will add changing this value.
  @Prop({ enum: ['private', 'public'], default: 'private' })
  visibility: 'private' | 'public';

  // ITN-05: the days in order (day 1 first).
  @Prop({ type: [ItineraryDaySchema], default: [] })
  days: Types.DocumentArray<ItineraryDay>;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ItinerarySchema = SchemaFactory.createForClass(Itinerary);
ItinerarySchema.index({ userId: 1, updatedAt: -1 });
