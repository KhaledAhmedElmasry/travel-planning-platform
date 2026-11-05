import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type CommentDocument = HydratedDocument<Comment>;

// Area: Community & Cross-cutting
// BLG-05 creates comments; hidden supports the shared GEN-10 moderation interface.
@Schema({ timestamps: true })
export class Comment {
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
  author: Types.ObjectId;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 500 })
  text: string;

  @Prop({ required: true, default: false, index: true })
  hidden: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
CommentSchema.index({ post: 1, hidden: 1, createdAt: 1, _id: 1 });
