import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// Area: Airlines & Flight Inventory
// Airline profile (PDF section 5 "Flights"): name, unique code, one logo and active status.
// Requirements: FLT-01, ACC-13, ACC-15
//
// - The moderator of an airline is the user with role airline_moderator and airlineId = this _id
//   (ACC-13, users/schemas/user.schema.ts).
// - active: false means the airline was deactivated by an admin (ACC-15, admin.service.ts sets it).
// - Extra-baggage policy (FLT-08): a price per extra bag (integer cents, > 0) and the maximum
//   number of extra bags per passenger (>= 0). Until the moderator sets it, extraBagPrice is null
//   and the maximum is 0, so no extra bags can be bought. Each extra bag has the same maximum
//   weight as the cabin's free allowance (Cabin.maxBagWeightKg, FLT-04).
// - Cancellation tiers (FLT-09): each with a unique daysBefore (>= 0) and a refundPercentage
//   (0-100), stored highest daysBefore first. Empty = no refunds. The refund rule is
//   pickRefundTier() in common/utils.

// FLT-09: one cancellation tier of an airline.
@Schema({ _id: false })
export class AirlineCancellationTier {
  @Prop({ required: true, min: 0 })
  daysBefore: number;

  @Prop({ required: true, min: 0, max: 100 })
  refundPercentage: number;
}
export const AirlineCancellationTierSchema = SchemaFactory.createForClass(
  AirlineCancellationTier,
);

export type AirlineDocument = HydratedDocument<Airline>;

@Schema({ timestamps: true })
export class Airline {
  @Prop({ required: true, trim: true, minlength: 1, maxlength: 100 })
  name: string;

  // Airline code, e.g. MS. Stored in upper case; the unique index makes it unique (FLT-01).
  @Prop({ required: true, trim: true, uppercase: true, unique: true })
  code: string;

  // Public path of the logo, e.g. /uploads/airlines/<file>.png, or null (GEN-08: 1 per airline).
  @Prop({ type: String, default: null })
  logoUrl: string | null;

  // FLT-08: price per extra bag in integer cents of the platform currency, or null (not set).
  @Prop({ type: Number, default: null, min: 1 })
  extraBagPrice: number | null;

  // FLT-08: maximum extra bags per passenger (0 = no extra bags).
  @Prop({ type: Number, required: true, default: 0, min: 0 })
  maxExtraBagsPerPassenger: number;

  // FLT-09: the cancellation tiers, highest daysBefore first.
  @Prop({ type: [AirlineCancellationTierSchema], default: [] })
  cancellationTiers: AirlineCancellationTier[];

  // ACC-15: deactivated airlines are hidden from guests and users.
  @Prop({ required: true, default: true, index: true })
  active: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AirlineSchema = SchemaFactory.createForClass(Airline);
