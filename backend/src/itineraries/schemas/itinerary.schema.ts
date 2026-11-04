import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

// Area: Itineraries
// ITN-01: a user's private itinerary. Days, activities, budgets, transport, cloning and public
// visibility are deliberately added by their own requirements rather than being represented here.

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

  createdAt?: Date;
  updatedAt?: Date;
}

export const ItinerarySchema = SchemaFactory.createForClass(Itinerary);
ItinerarySchema.index({ userId: 1, updatedAt: -1 });
