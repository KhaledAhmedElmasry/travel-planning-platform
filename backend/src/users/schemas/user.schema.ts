import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { AccountStatus, Role } from '../../common/enums';

// Area: Auth & Accounts
// User account (PDF section 5 "Accounts and Roles"): credentials, profile, role, account status,
// preferences and the moderator assignment to one airline or hotel.
// See ACC-01, ACC-03, ACC-05, ACC-07a, ACC-09, ACC-12, ACC-13, GEN-13.
//
// Field names match the seeded admin account in database/seed.ts (ACC-18).
// Never store plain passwords (GEN-13): only the bcrypt hash, which is excluded from queries by
// default. Login (ACC-04) reads it explicitly with .select('+passwordHash').
//
// Bonus ACC-02: whether the email is verified.

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true, minlength: 1, maxlength: 100 })
  name: string;

  // Trimmed and lowercased before saving, so the unique index makes the email unique
  // case-insensitively, including two registrations at the same moment (ACC-01, ACC-03).
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ type: String, enum: Role, required: true, default: Role.User })
  role: Role;

  @Prop({
    type: String,
    enum: AccountStatus,
    required: true,
    default: AccountStatus.Active,
  })
  status: AccountStatus;

  // ACC-09
  @Prop({ trim: true })
  phone?: string;

  // ACC-09: from the supported currency list (GEN-12). Used only to display itinerary budgets.
  @Prop({ required: true, uppercase: true, minlength: 3, maxlength: 3 })
  preferredCurrency: string;

  // ACC-01, ACC-03: when the terms-and-privacy consent was given. Not set for seeded admins.
  @Prop({ type: Date })
  termsAcceptedAt?: Date;

  // ACC-05: lockout after 5 consecutive failed logins.
  @Prop({ required: true, default: 0, min: 0 })
  failedLoginAttempts: number;

  @Prop({ type: Date, default: null })
  lockUntil: Date | null;

  // ACC-07a, ACC-13: a temporary password must be changed at the next login.
  @Prop({ required: true, default: false })
  mustChangePassword: boolean;

  // ACC-13: a moderator is assigned to exactly one airline or one hotel.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Airline', default: null })
  airlineId: Types.ObjectId | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Hotel', default: null })
  hotelId: Types.ObjectId | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
