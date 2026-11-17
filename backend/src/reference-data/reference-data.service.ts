import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import {
  DEFAULT_PAGE_SIZE,
  getPaginationOffset,
  paginate,
  PaginatedList,
  PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { ListAirportsQueryDto } from './dto/list-airports-query.dto';
import { ListAttractionsQueryDto } from './dto/list-attractions-query.dto';
import { ListCitiesQueryDto } from './dto/list-cities-query.dto';
import { ListCountriesQueryDto } from './dto/list-countries-query.dto';
import {
  Airport,
  AirportDocument,
  Attraction,
  AttractionDocument,
  City,
  CityDocument,
  Country,
  CountryDocument,
  Currency,
  CurrencyDocument,
} from './schemas/reference-data.schema';

// One item of GET /api/currencies.
export interface CurrencyItem {
  code: string;
  name: string;
}

// One item of GET /api/countries.
export interface CountryItem {
  code: string;
  name: string;
  currency: string;
}

// One item of GET /api/cities.
export interface CityItem {
  cityId: string;
  name: string;
  countryCode: string;
}

// One item of GET /api/attractions.
export interface AttractionItem {
  attractionId: string;
  name: string;
  cityId: string;
}

// One item of GET /api/airports.
export interface AirportItem {
  iataCode: string;
  name: string;
  cityId: string;
  cityName: string;
  countryCode: string;
  timeZone: string;
}

// Makes user text safe to use inside a regular expression (search filters).
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Area: Reference Data & Seeding
// Business logic and database access for: FLT-02, GEN-12
//
// All reference data is read-only: it is loaded by the seed script (npm run seed) and never
// changed through the API.
//
// Lookups for other modules (import ReferenceDataModule, inject ReferenceDataService):
//   assertSupportedCurrency(code)               GEN-12, e.g. preferred currency (ACC-09)
//   assertCountry(code) / assertCountries(codes)  GEN-12, e.g. itinerary countries (ITN-01)
//   assertCity(cityId)                          GEN-12, e.g. itinerary day city (ITN-05)
//   assertCityInCountry(cityId, countryCode)    GEN-12, e.g. hotel city and country (HTL-01)
//   assertAirport(iataCode)                     FLT-02, e.g. flight airports (FLT-03, FLT-11)
//   findAirport(iataCode)                       FLT-02, the airport with its IANA time zone (GEN-06)
// Each one throws 400 (BadRequestException) with a clear message for an unknown value.
@Injectable()
export class ReferenceDataService {
  constructor(
    @InjectModel(Country.name)
    private readonly countryModel: Model<CountryDocument>,
    @InjectModel(City.name)
    private readonly cityModel: Model<CityDocument>,
    @InjectModel(Airport.name)
    private readonly airportModel: Model<AirportDocument>,
    @InjectModel(Attraction.name)
    private readonly attractionModel: Model<AttractionDocument>,
    @InjectModel(Currency.name)
    private readonly currencyModel: Model<CurrencyDocument>,
  ) {}

  // ---------------------------------------------------------------------------
  // Read endpoints
  // ---------------------------------------------------------------------------

  // GEN-12: the supported currency list, sorted by code, 10 per page (GEN-05).
  // No currencies (database not seeded yet) is an empty page, not an error (GEN-04).
  async listCurrencies(
    query: PaginationQueryDto,
  ): Promise<PaginatedList<CurrencyItem>> {
    const page = query.page ?? 1;
    const { skip, limit } = getPaginationOffset(page, DEFAULT_PAGE_SIZE);

    const [currencies, total] = await Promise.all([
      this.currencyModel
        .find()
        .sort({ _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.currencyModel.countDocuments().exec(),
    ]);

    const items = currencies.map((c) => ({ code: c.code, name: c.name }));
    return paginate(items, total, page, DEFAULT_PAGE_SIZE);
  }

  // GEN-12: the countries, sorted by name, optionally searched by code or name.
  async listCountries(
    query: ListCountriesQueryDto,
  ): Promise<PaginatedList<CountryItem>> {
    const filter: FilterQuery<CountryDocument> = {};
    if (query.search) {
      const pattern = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ code: pattern }, { name: pattern }];
    }

    const page = query.page ?? 1;
    const { skip, limit } = getPaginationOffset(page, DEFAULT_PAGE_SIZE);

    const [countries, total] = await Promise.all([
      this.countryModel
        .find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.countryModel.countDocuments(filter).exec(),
    ]);

    const items = countries.map((c) => ({
      code: c.code,
      name: c.name,
      currency: c.currency,
    }));
    return paginate(items, total, page, DEFAULT_PAGE_SIZE);
  }

  // GEN-12: the cities, sorted by name, optionally of one country and searched by id or name.
  // An unknown country code is rejected with 400, so a typo is not shown as "no cities".
  async listCities(
    query: ListCitiesQueryDto,
  ): Promise<PaginatedList<CityItem>> {
    const filter: FilterQuery<CityDocument> = {};
    if (query.country) {
      await this.assertCountry(query.country);
      filter.countryCode = query.country;
    }
    if (query.search) {
      const pattern = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ cityId: pattern }, { name: pattern }];
    }

    const page = query.page ?? 1;
    const { skip, limit } = getPaginationOffset(page, DEFAULT_PAGE_SIZE);

    const [cities, total] = await Promise.all([
      this.cityModel
        .find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.cityModel.countDocuments(filter).exec(),
    ]);

    const items = cities.map((c) => ({
      cityId: c.cityId,
      name: c.name,
      countryCode: c.countryCode,
    }));
    return paginate(items, total, page, DEFAULT_PAGE_SIZE);
  }

  // FLT-02: the predefined, read-only airport list, sorted by IATA code, 10 per page (GEN-05).
  // search matches part of the IATA code, airport name or city name (case-insensitive).
  // An unknown city or country filter is rejected with 400.
  async listAirports(
    query: ListAirportsQueryDto,
  ): Promise<PaginatedList<AirportItem>> {
    const filter: FilterQuery<AirportDocument> = {};
    if (query.city) {
      await this.assertCity(query.city);
      filter.cityId = query.city;
    }
    if (query.country) {
      await this.assertCountry(query.country);
      filter.countryCode = query.country;
    }
    if (query.search) {
      const pattern = new RegExp(escapeRegex(query.search), 'i');
      const matchingCities = await this.cityModel
        .find({ name: pattern })
        .select('_id')
        .lean()
        .exec();
      filter.$or = [
        { iataCode: pattern },
        { name: pattern },
        { cityId: { $in: matchingCities.map((c) => c._id) } },
      ];
    }

    const page = query.page ?? 1;
    const { skip, limit } = getPaginationOffset(page, DEFAULT_PAGE_SIZE);

    const [airports, total] = await Promise.all([
      this.airportModel
        .find(filter)
        .sort({ _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.airportModel.countDocuments(filter).exec(),
    ]);

    // The city name of each airport on this page, read in one query.
    const cities = await this.cityModel
      .find({ _id: { $in: [...new Set(airports.map((a) => a.cityId))] } })
      .lean()
      .exec();
    const cityNames = new Map(cities.map((c) => [c._id, c.name]));

    const items = airports.map((a) => ({
      iataCode: a.iataCode,
      name: a.name,
      cityId: a.cityId,
      cityName: cityNames.get(a.cityId) ?? a.cityId,
      countryCode: a.countryCode,
      timeZone: a.timeZone,
    }));
    return paginate(items, total, page, DEFAULT_PAGE_SIZE);
  }

  // GEN-12: the attractions, sorted by name, optionally of one city.
  // An unknown city id is rejected with 400.
  async listAttractions(
    query: ListAttractionsQueryDto,
  ): Promise<PaginatedList<AttractionItem>> {
    const filter: FilterQuery<AttractionDocument> = {};
    if (query.city) {
      await this.assertCity(query.city);
      filter.cityId = query.city;
    }

    const page = query.page ?? 1;
    const { skip, limit } = getPaginationOffset(page, DEFAULT_PAGE_SIZE);

    const [attractions, total] = await Promise.all([
      this.attractionModel
        .find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.attractionModel.countDocuments(filter).exec(),
    ]);

    const items = attractions.map((a) => ({
      attractionId: a.attractionId,
      name: a.name,
      cityId: a.cityId,
    }));
    return paginate(items, total, page, DEFAULT_PAGE_SIZE);
  }

  // ---------------------------------------------------------------------------
  // Lookups for other modules
  // ---------------------------------------------------------------------------

  // GEN-12: whether a currency code is in the supported list.
  async isSupportedCurrency(code: string): Promise<boolean> {
    if (typeof code !== 'string' || code.trim() === '') return false;
    const found = await this.currencyModel
      .exists({ _id: code.trim().toUpperCase() })
      .exec();
    return found !== null;
  }

  // GEN-12: throws 400 when the currency is not supported.
  async assertSupportedCurrency(code: string): Promise<void> {
    if (!(await this.isSupportedCurrency(code))) {
      throw new BadRequestException(
        `Currency "${code}" is not in the supported currency list.`,
      );
    }
  }

  // GEN-12: the country with this code (e.g. EG), or null.
  async findCountry(code: string): Promise<Country | null> {
    if (typeof code !== 'string' || code.trim() === '') return null;
    return this.countryModel
      .findById(code.trim().toUpperCase())
      .lean<Country>()
      .exec();
  }

  // GEN-12: the city with this id (e.g. cairo), or null.
  async findCity(cityId: string): Promise<City | null> {
    if (typeof cityId !== 'string' || cityId.trim() === '') return null;
    return this.cityModel.findById(cityId.trim()).lean<City>().exec();
  }

  // GEN-12: throws 400 when the country is not in the official list.
  async assertCountry(code: string): Promise<Country> {
    const country = await this.findCountry(code);
    if (!country) {
      throw new BadRequestException(`Unknown countryCode "${code}".`);
    }
    return country;
  }

  // GEN-12: throws 400 when any of the countries is not in the official list (e.g. ITN-01).
  async assertCountries(codes: string[]): Promise<void> {
    const wanted = [
      ...new Set(
        (codes ?? []).map((code) => String(code).trim().toUpperCase()),
      ),
    ];
    const found = await this.countryModel
      .find({ _id: { $in: wanted } })
      .select('_id')
      .lean()
      .exec();
    const foundIds = new Set(found.map((c) => c._id));
    const unknown = wanted.filter((code) => !foundIds.has(code));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown countryCode ${unknown.map((c) => `"${c}"`).join(', ')}.`,
      );
    }
  }

  // GEN-12: throws 400 when the city is not in the official list.
  async assertCity(cityId: string): Promise<City> {
    const city = await this.findCity(cityId);
    if (!city) {
      throw new BadRequestException(`Unknown cityId "${cityId}".`);
    }
    return city;
  }

  // FLT-02: the airport with this IATA code (e.g. CAI), with its IANA time zone, or null.
  async findAirport(iataCode: string): Promise<Airport | null> {
    if (typeof iataCode !== 'string' || iataCode.trim() === '') return null;
    return this.airportModel
      .findById(iataCode.trim().toUpperCase())
      .lean<Airport>()
      .exec();
  }

  // FLT-02: throws 400 when the airport is not in the airport list. Flight creation and flight
  // search accept only these airports (FLT-03, FLT-11).
  // The airports of a city (ITN-26: any airport in the city of an itinerary's first day).
  findAirportsInCity(cityId: string): Promise<Airport[]> {
    return this.airportModel
      .find({ cityId })
      .sort({ _id: 1 })
      .lean<Airport[]>()
      .exec();
  }

  async assertAirport(iataCode: string): Promise<Airport> {
    const airport = await this.findAirport(iataCode);
    if (!airport) {
      throw new BadRequestException(
        `Airport "${iataCode}" is not in the airport list.`,
      );
    }
    return airport;
  }

  // GEN-12: throws 400 when the country or city is unknown, or the city is not in the country.
  async assertCityInCountry(
    cityId: string,
    countryCode: string,
  ): Promise<City> {
    const country = await this.assertCountry(countryCode);
    const city = await this.assertCity(cityId);
    if (city.countryCode !== country.code) {
      throw new BadRequestException(
        `City "${cityId}" is not in country "${countryCode}".`,
      );
    }
    return city;
  }
}
