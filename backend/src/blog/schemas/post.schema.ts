import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export enum PostStatus {
  Draft = 'draft',
  Published = 'published',
}

export type PostDocument = HydratedDocument<Post>;

// Matches UploadsService.StoredImage. storageKey remains internal and is never
// copied into Blog API response objects.
@Schema({ _id: false })
export class PostImageReference {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true, select: false })
  storageKey: string;
}

const PostImageReferenceSchema =
  SchemaFactory.createForClass(PostImageReference);

// Area: Community & Cross-cutting
// BLG-01 creates posts; the fields below also provide a stable base for later Blog requirements.
// Image uploads are managed by BLG-10/GEN-08; this field stores their references for cleanup.
@Schema({ timestamps: true })
export class Post {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  author: Types.ObjectId;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 200 })
  title: string;

  @Prop({ required: true, trim: true, minlength: 1 })
  body: string;

  @Prop({ type: String, enum: PostStatus, required: true })
  status: PostStatus;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [PostImageReferenceSchema], default: [] })
  images: PostImageReference[];

  @Prop({ required: true, default: false, index: true })
  hidden: boolean;

  @Prop({ required: true, min: 0, default: 0 })
  likeCount: number;

  @Prop({ required: true, min: 0, default: 0 })
  commentCount: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PostSchema = SchemaFactory.createForClass(Post);
PostSchema.index({ status: 1, hidden: 1, createdAt: -1 });
