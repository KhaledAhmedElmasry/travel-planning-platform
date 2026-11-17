import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

// BONUS (optional): implement only after all mandatory requirements are done (PDF section 12).
// Area: Auth & Accounts (bonus)
// One-time email tokens: verification links (ACC-02) and later password-reset links (ACC-07).
// Only the SHA-256 hash of the token is stored, so a database leak gives no usable link.

export enum EmailTokenPurpose {
  VerifyEmail = 'verify_email',
  ResetPassword = 'reset_password',
}

export type EmailTokenDocument = HydratedDocument<EmailToken>;

@Schema({ timestamps: true })
export class EmailToken {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ type: String, enum: EmailTokenPurpose, required: true })
  purpose: EmailTokenPurpose;

  // After this moment the link no longer works. MongoDB deletes the document automatically.
  @Prop({ type: Date, required: true })
  expiresAt: Date;

  // Set when the link is used: each link works once.
  @Prop({ type: Date, default: null })
  usedAt: Date | null;
}

export const EmailTokenSchema = SchemaFactory.createForClass(EmailToken);

EmailTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
