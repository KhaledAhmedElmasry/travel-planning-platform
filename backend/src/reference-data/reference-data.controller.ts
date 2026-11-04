import { Controller, Get, Query } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { ListAirportsQueryDto } from './dto/list-airports-query.dto';
import { ListAttractionsQueryDto } from './dto/list-attractions-query.dto';
import { ListCitiesQueryDto } from './dto/list-cities-query.dto';
import { ListCountriesQueryDto } from './dto/list-countries-query.dto';
import { ReferenceDataService } from './reference-data.service';

// Area: Reference Data & Seeding
// Requirements: FLT-02, GEN-12, NEW-05
// Endpoints to implement (PDF section 8):
//   GET /api/airports   FLT-03, FLT-11
// Extra endpoints (not in the PDF tables, documented in docs/api/openapi.yaml):
//   GET /api/currencies    GEN-12 (supported currency list, also used by ACC-09 and ITN-18)
//   GET /api/countries     NEW-05
//   GET /api/cities        NEW-05 (filter by country)
//   GET /api/attractions   NEW-05 (filter by city)
// Notes:
//   The airports endpoint returns the predefined, read-only airport list (FLT-02).
//   All public and read-only. Use the official ids from the datasets (EG, cairo, CAI, att-1).
//   The lookups other modules use (unknown country, city, airport → 400) are in
//   ReferenceDataService (NEW-05, FLT-02).
@Controller()
export class ReferenceDataController {
  constructor(private readonly referenceDataService: ReferenceDataService) {}

  // FLT-02: the predefined, read-only airport list (FLT-03, FLT-11). Public.
  @Get('airports')
  listAirports(@Query() query: ListAirportsQueryDto) {
    return this.referenceDataService.listAirports(query);
  }

  // GEN-12: the supported currency list. Public, read-only.
  @Get('currencies')
  listCurrencies(@Query() query: PaginationQueryDto) {
    return this.referenceDataService.listCurrencies(query);
  }

  // NEW-05: the official countries. Public, read-only.
  @Get('countries')
  listCountries(@Query() query: ListCountriesQueryDto) {
    return this.referenceDataService.listCountries(query);
  }

  // NEW-05: the official cities, optionally of one country. Public, read-only.
  @Get('cities')
  listCities(@Query() query: ListCitiesQueryDto) {
    return this.referenceDataService.listCities(query);
  }

  // NEW-05: the official attractions, optionally of one city. Public, read-only.
  @Get('attractions')
  listAttractions(@Query() query: ListAttractionsQueryDto) {
    return this.referenceDataService.listAttractions(query);
  }
}
