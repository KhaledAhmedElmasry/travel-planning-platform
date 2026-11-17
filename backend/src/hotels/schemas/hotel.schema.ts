import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema()
export class HotelPhoto {
  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  filename: string;
}
export const HotelPhotoSchema = SchemaFactory.createForClass(HotelPhoto);

// Filled by PUT /api/hotels/:id/policies (HTL-10). Empty at creation.
@Schema({ _id: false })
export class HotelCancellationTier {
  @Prop({ required: true, min: 0 })
  daysBefore: number;

  @Prop({ required: true, min: 0, max: 100 })
  refundPercentage: number;
}
export const HotelCancellationTierSchema = SchemaFactory.createForClass(
  HotelCancellationTier,
);

@Schema({ timestamps: true })
export class Hotel {
  // Agreed with Area 1: keep `name` and `active`.
  @Prop({ required: true, trim: true, maxlength: 100 })
  name: string;

  @Prop({ required: true, trim: true, maxlength: 200 })
  address: string;

  // Official ids from the reference data (GEN-12), e.g. 'cairo' and 'EG'.
  @Prop({ required: true })
  cityId: string;

  @Prop({ required: true })
  countryCode: string;

  @Prop({ required: true, trim: true, maxlength: 2000 })
  description: string;

  @Prop({ required: true, min: 1, max: 5 })
  starRating: number;

  @Prop({ type: [String], default: [] })
  amenities: string[];

  @Prop({ type: [HotelPhotoSchema], default: [] })
  photos: HotelPhoto[];

  // HTL-09: HH:mm, set through PUT /policies. Null until then.
  @Prop({ type: String, default: null })
  checkInTime: string | null;

  @Prop({ type: String, default: null })
  checkOutTime: string | null;

  // HTL-10
  @Prop({ type: [HotelCancellationTierSchema], default: [] })
  cancellationTiers: HotelCancellationTier[];

  // ACC-15: false = deactivated, cannot be found or booked.
  @Prop({ default: true })
  active: boolean;

  // Kept up to date by reviews (HTL-12, HTL-23, HTL-24).
  @Prop({ default: 0, min: 0, max: 5 })
  averageRating: number;

  @Prop({ default: 0, min: 0 })
  ratingCount: number;
}

export type HotelDocument = HydratedDocument<Hotel>;
export const HotelSchema = SchemaFactory.createForClass(Hotel);

// Search by destination (HTL-11) only looks at active hotels.
HotelSchema.index({ countryCode: 1, cityId: 1, active: 1 });
