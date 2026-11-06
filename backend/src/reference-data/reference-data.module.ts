import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReferenceDataController } from './reference-data.controller';
import { ReferenceDataService } from './reference-data.service';
import {
  Airport,
  AirportSchema,
  Attraction,
  AttractionSchema,
  City,
  CitySchema,
  Country,
  CountrySchema,
  Currency,
  CurrencySchema,
} from './schemas/reference-data.schema';

// Area: Reference Data & Seeding
// Requirements: GEN-12, FLT-02
//
// ReferenceDataService is exported: import ReferenceDataModule in another module to use its
// lookups (e.g. reject an unknown currency, country, city or airport).
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Country.name, schema: CountrySchema },
      { name: City.name, schema: CitySchema },
      { name: Airport.name, schema: AirportSchema },
      { name: Attraction.name, schema: AttractionSchema },
      { name: Currency.name, schema: CurrencySchema },
    ]),
  ],
  controllers: [ReferenceDataController],
  providers: [ReferenceDataService],
  exports: [ReferenceDataService],
})
export class ReferenceDataModule {}
