import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { AuditAction } from '../../common/enums';

// Area: Community & Cross-cutting
// Audit Log entry (GEN-07): records administrative actions such as
// account suspensions, password resets, moderator creations, and content moderation.

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  adminId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  adminName: string;

  @Prop({ required: true, trim: true, lowercase: true })
  adminEmail: string;

  @Prop({ type: String, required: true, index: true })
  action: AuditAction | string;

  @Prop({ required: true, trim: true })
  targetType: string;

  @Prop({ required: true, trim: true })
  targetId: string;

  @Prop({ trim: true, default: null })
  reason?: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  details?: Record<string, unknown>;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
