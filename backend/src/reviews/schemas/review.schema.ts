import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ReviewDocument = HydratedDocument<Review>;

// Area: Hotel Booking & Reviews
// HTL-23: one review for each completed reservation. hidden is managed by GEN-10.
@Schema({ timestamps: true })
export class Review {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'HotelBooking',
    required: true,
  })
  reservation: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Hotel', required: true })
  hotel: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5, validate: Number.isInteger })
  rating: number;

  @Prop({ trim: true, maxlength: 1000 })
  text?: string;

  @Prop({ type: Boolean, required: true, default: false, index: true })
  hidden: boolean;

  // HTL-26 (bonus): the hotel moderator's one reply. Absent until a reply exists.
  @Prop({
    type: {
      _id: false,
      text: { type: String, required: true, trim: true, maxlength: 1000 },
      moderator: {
        type: MongooseSchema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      createdAt: { type: Date, required: true },
    },
    required: false,
  })
  reply?: { text: string; moderator: Types.ObjectId; createdAt: Date };

  createdAt?: Date;
  updatedAt?: Date;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);
ReviewSchema.index({ reservation: 1 }, { unique: true });
ReviewSchema.index({ hotel: 1, hidden: 1, createdAt: -1 });
