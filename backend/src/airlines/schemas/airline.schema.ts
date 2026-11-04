import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// Area: Airlines & Flight Inventory
// Airline profile (PDF section 5 "Flights"): name, unique code, one logo and active status.
// Requirements: FLT-01, ACC-13, ACC-15
//
// - The moderator of an airline is the user with role airline_moderator and airlineId = this _id
//   (ACC-13, users/schemas/user.schema.ts).
// - active: false means the airline was deactivated by an admin (ACC-15, admin.service.ts sets it).
// - The extra-baggage policy (FLT-08) and the cancellation tiers (FLT-09) are added to this
//   schema by their own requirements.

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

  // ACC-15: deactivated airlines are hidden from guests and users.
  @Prop({ required: true, default: true, index: true })
  active: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AirlineSchema = SchemaFactory.createForClass(Airline);
