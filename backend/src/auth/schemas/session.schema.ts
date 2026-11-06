import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

// Area: Auth & Accounts
// Refresh-token sessions (ACC-19): user, hashed token, expiry, last activity, revoked.
// One document per login. The refresh token itself is never stored, only its SHA-256 hash, so a
// database leak does not give anyone a usable session.

export type SessionDocument = HydratedDocument<Session>;

@Schema({ timestamps: true })
export class Session {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({ required: true })
  tokenHash: string;

  // ACC-06: the last authenticated request; 30 minutes without one ends the session.
  @Prop({ type: Date, required: true })
  lastActivityAt: Date;

  // After this moment the session cannot be refreshed. MongoDB deletes it automatically.
  @Prop({ type: Date, required: true })
  expiresAt: Date;

  // Set by logout (ACC-06), deactivation (ACC-12), suspension (ACC-15) or a password reset (ACC-07a).
  @Prop({ type: Date, default: null })
  revokedAt: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// TTL index: MongoDB removes expired sessions (checked about once a minute).
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
