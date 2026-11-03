import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { ContentType, ReportStatus } from '../../common/enums';

// Area: Community & Cross-cutting
// Report (GEN-09): reporter, content type and id, reason, status.
// Users can report a post, comment, review or itinerary at most once per item.

export type ReportDocument = HydratedDocument<Report>;

@Schema({ timestamps: true, collection: 'reports' })
export class Report {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  reporterId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  reporterName: string;

  @Prop({ required: true, trim: true, lowercase: true })
  reporterEmail: string;

  @Prop({ type: String, enum: ContentType, required: true, index: true })
  contentType: ContentType;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  contentId: Types.ObjectId;

  @Prop({ trim: true, default: null })
  contentPreview?: string;

  @Prop({ required: true, trim: true, maxlength: 500 })
  reason: string;

  @Prop({
    type: String,
    enum: ReportStatus,
    default: ReportStatus.Open,
    index: true,
  })
  status: ReportStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  resolvedBy?: Types.ObjectId;

  @Prop({ type: Date, default: null })
  resolvedAt?: Date;

  @Prop({ trim: true, maxlength: 500, default: null })
  resolutionNote?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ReportSchema = SchemaFactory.createForClass(Report);

// GEN-09: A user can report a specific item at most once.
ReportSchema.index(
  { reporterId: 1, contentType: 1, contentId: 1 },
  { unique: true },
);

// Query indexes for admin listing (GEN-09, GEN-10)
ReportSchema.index({ status: 1, createdAt: -1 });
ReportSchema.index({ status: 1, contentType: 1, createdAt: -1 });
ReportSchema.index({ contentType: 1, contentId: 1 });
