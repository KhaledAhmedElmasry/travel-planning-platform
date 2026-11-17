import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class ExchangeRate {
  @Prop({ required: true, uppercase: true })
  baseCurrency: string;

  @Prop({ required: true })
  fetchedDate: string;

  @Prop({ required: true })
  rateDate: string;

  @Prop({ type: Map, of: Number, required: true })
  rates: Map<string, number>;

  createdAt?: Date;
  updatedAt?: Date;
}

export type ExchangeRateDocument = HydratedDocument<ExchangeRate>;
export const ExchangeRateSchema = SchemaFactory.createForClass(ExchangeRate);
ExchangeRateSchema.index({ baseCurrency: 1, fetchedDate: 1 }, { unique: true });
