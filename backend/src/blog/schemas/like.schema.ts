import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type LikeDocument = HydratedDocument<Like>;

// Area: Community & Cross-cutting
// One record per user/post pair. The unique compound index is the concurrency-safe
// enforcement of BLG-06's one-like-per-user rule.
@Schema({ timestamps: true })
export class Like {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Post',
    required: true,
  })
  post: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  user: Types.ObjectId;
}

export const LikeSchema = SchemaFactory.createForClass(Like);
LikeSchema.index({ post: 1, user: 1 }, { unique: true });
