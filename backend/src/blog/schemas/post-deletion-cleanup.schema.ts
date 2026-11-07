import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type PostDeletionCleanupDocument = HydratedDocument<PostDeletionCleanup>;

// Durable retry record for BLG-04 image cleanup after the post deletion commits.
@Schema({ timestamps: true })
export class PostDeletionCleanup {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  postId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  author: Types.ObjectId;

  @Prop({ type: [String], required: true })
  storageKeys: string[];
}

export const PostDeletionCleanupSchema =
  SchemaFactory.createForClass(PostDeletionCleanup);
PostDeletionCleanupSchema.index({ postId: 1 }, { unique: true });
