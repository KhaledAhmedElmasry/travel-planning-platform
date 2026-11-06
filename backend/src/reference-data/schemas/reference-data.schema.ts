import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// Area: Reference Data & Seeding
// Requirements: GEN-12, FLT-02 (PDF section 5.1)
//
// The read-only reference data loaded by database/seed.ts (npm run seed). The official ids from
// the datasets are the document _id values (EG, cairo, CAI, att-1, USD), and the collection and
// field names are exactly the ones the seed script writes:
//   countries   { _id: code, code, name, currency }
//   cities      { _id: cityId, cityId, name, countryCode }
//   airports    { _id: iataCode, iataCode, name, cityId, countryCode, timeZone }
//   attractions { _id: attractionId, attractionId, name, cityId }
//   currencies  { _id: code, code, name }
//
// No timestamps and no version key: these documents are only written by the seed script, which
// replaces them by their official id, and the API never changes them.

// ---------------------------------------------------------------------------
// Countries, e.g. { _id: 'EG', code: 'EG', name: 'Egypt', currency: 'EGP' }
// ---------------------------------------------------------------------------
@Schema({ collection: 'countries', versionKey: false })
export class Country {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true, uppercase: true, trim: true })
  code: string;

  @Prop({ required: true, trim: true })
  name: string;

  // Code of the country's currency, e.g. EGP.
  @Prop({ required: true, uppercase: true, trim: true })
  currency: string;
}

export type CountryDocument = HydratedDocument<Country>;
export const CountrySchema = SchemaFactory.createForClass(Country);

// ---------------------------------------------------------------------------
// Cities, e.g. { _id: 'cairo', cityId: 'cairo', name: 'Cairo', countryCode: 'EG' }
// ---------------------------------------------------------------------------
@Schema({ collection: 'cities', versionKey: false })
export class City {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true, trim: true })
  cityId: string;

  @Prop({ required: true, trim: true })
  name: string;

  // The country this city belongs to (GEN-12).
  @Prop({ required: true, uppercase: true, trim: true, index: true })
  countryCode: string;
}

export type CityDocument = HydratedDocument<City>;
export const CitySchema = SchemaFactory.createForClass(City);

// ---------------------------------------------------------------------------
// Airports, e.g. { _id: 'CAI', iataCode: 'CAI', name: 'Cairo International Airport',
//                  cityId: 'cairo', countryCode: 'EG', timeZone: 'Africa/Cairo' }
// ---------------------------------------------------------------------------
@Schema({ collection: 'airports', versionKey: false })
export class Airport {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true, uppercase: true, trim: true })
  iataCode: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, index: true })
  cityId: string;

  @Prop({ required: true, uppercase: true, trim: true, index: true })
  countryCode: string;

  // IANA time zone (FLT-02), used to show flight times in the airport's local time (GEN-06).
  @Prop({ required: true, trim: true })
  timeZone: string;
}

export type AirportDocument = HydratedDocument<Airport>;
export const AirportSchema = SchemaFactory.createForClass(Airport);

// ---------------------------------------------------------------------------
// Attractions, e.g. { _id: 'att-1', attractionId: 'att-1', name: 'Giza Pyramids and Sphinx',
//                     cityId: 'cairo' }
// ---------------------------------------------------------------------------
@Schema({ collection: 'attractions', versionKey: false })
export class Attraction {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true, trim: true })
  attractionId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, index: true })
  cityId: string;
}

export type AttractionDocument = HydratedDocument<Attraction>;
export const AttractionSchema = SchemaFactory.createForClass(Attraction);

// ---------------------------------------------------------------------------
// Supported currencies (GEN-12), e.g. { _id: 'USD', code: 'USD', name: 'US Dollar' }
// The seed script builds this list from the platform currency and the countries' currencies.
// ---------------------------------------------------------------------------
@Schema({ collection: 'currencies', versionKey: false })
export class Currency {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true, uppercase: true, trim: true })
  code: string;

  @Prop({ required: true, trim: true })
  name: string;
}

export type CurrencyDocument = HydratedDocument<Currency>;
export const CurrencySchema = SchemaFactory.createForClass(Currency);
