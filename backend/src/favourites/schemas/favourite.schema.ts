import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export enum FavouriteType {
  Hotel = 'hotel',
  Itinerary = 'itinerary',
}

@Schema({ timestamps: true })
export class Favourite {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: FavouriteType, required: true })
  type: FavouriteType;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  targetId: Types.ObjectId;
}

export type FavouriteDocument = HydratedDocument<Favourite>;
export const FavouriteSchema = SchemaFactory.createForClass(Favourite);

FavouriteSchema.index({ userId: 1, type: 1, targetId: 1 }, { unique: true });
