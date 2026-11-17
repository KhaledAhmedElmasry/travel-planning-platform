// Area: Flight Search & Booking
// Requirements: FLT-11, FLT-12, FLT-15, GEN-04, GEN-05, GEN-06, PAY-04.
//
// GET /api/flights/search (everyone, including guests):
//   - only Scheduled flights that have not departed (FLT-30, openFlightFilter) of ACTIVE airlines
//     (ACC-15), on the departure date = the local date at the departure airport (the flight's
//     stored departureDate, FLT-03);
//   - a cabin matches when its free seats (total - booked - held) cover adults + children
//     (infants need no seat, FLT-12), it is the requested cabinClass (if any) and its fare is in
//     [minPrice, maxPrice] (FLT-15); a flight is listed when at least one cabin matches;
//   - sorted by price (lowest matching fare), duration or departure time (FLT-15);
//   - paginated, page size 10 (GEN-05); no match = empty page with a message (GEN-04);
//   - round trip: an outbound and a return list, each paginated the same way (FLT-12).
// Uses the real Flight model (schemas/flight.schema.ts), the Airline model (airlines module)
// and the airport list (ReferenceDataService, FLT-02). Never changes any data.
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Airline } from '../airlines/schemas/airline.schema';
import { DEFAULT_PAGE_SIZE, paginate } from '../common/dto';
import { CabinClass } from '../common/enums';
import { platformCurrency } from '../payments/platform-currency';
import { ReferenceDataService } from '../reference-data/reference-data.service';
import { Airport } from '../reference-data/schemas/reference-data.schema';
import {
  FlightSearchAirline,
  FlightSearchAirport,
  FlightSearchCabin,
  FlightSearchItem,
  FlightSearchPage,
  RoundTripFlightSearchResult,
} from './dto/flight-search-response.dto';
import {
  FlightSortBy,
  SearchFlightsQueryDto,
  SortOrder,
  TripType,
} from './dto/search-flights-query.dto';
import { openFlightFilter } from './flight-status.job';
import { utcOffset, utcToLocal } from './flight-time';
import { Cabin, Flight } from './schemas/flight.schema';
import {
  durationMinutes,
  seatsRemaining,
} from './utils/flight-details.helpers';
import {
  calculatePassengerPricing,
  PassengerCounts,
  validatePassengerCounts,
} from './utils/passenger-pricing';
import {
  compareFlightSearchResults,
  isWithinPriceRange,
  PriceRange,
  validatePriceRange,
} from './utils/flight-sorting';

type LeanFlight = Flight & { _id: Types.ObjectId };
type LeanAirline = Pick<Airline, 'name' | 'code' | 'logoUrl'> & {
  _id: Types.ObjectId;
};
type LeanCabin = Cabin & { _id: Types.ObjectId };

interface LegSearch extends PriceRange {
  // The departure and arrival airports a flight of this leg may use.
  origins: Airport[];
  destinations: Airport[];
  date: string;
  page: number;
  passengers: PassengerCounts;
  cabinClass?: CabinClass;
  sortBy: FlightSortBy;
  sortOrder: SortOrder;
  emptyMessage: string;
}

@Injectable()
export class FlightSearchService {
  constructor(
    @InjectModel(Flight.name) private readonly flightModel: Model<Flight>,
    @InjectModel(Airline.name) private readonly airlineModel: Model<Airline>,
    private readonly referenceData: ReferenceDataService,
    private readonly config: ConfigService,
  ) {}

  async search(
    query: SearchFlightsQueryDto,
  ): Promise<FlightSearchPage | RoundTripFlightSearchResult> {
    if (query.origin === query.destination) {
      throw new BadRequestException(
        'origin and destination must be different airports.',
      );
    }
    // 400 "Airport ... is not in the airport list." (FLT-02).
    const [origin, destination] = await Promise.all([
      this.referenceData.assertAirport(query.origin),
      this.referenceData.assertAirport(query.destination),
    ]);
    return this.searchBetween(query, [origin], [destination]);
  }

  // ITN-26: flights from one airport to ANY airport of a city (the city of an itinerary's first
  // day), with the same rules as the flight search (FLT-11, FLT-12, FLT-15).
  async searchToCity(
    query: Omit<SearchFlightsQueryDto, 'destination'>,
    cityId: string,
  ): Promise<FlightSearchPage | RoundTripFlightSearchResult> {
    const origin = await this.referenceData.assertAirport(query.origin);
    const destinations = (
      await this.referenceData.findAirportsInCity(cityId)
    ).filter((airport) => airport.iataCode !== origin.iataCode);
    if (destinations.length === 0) {
      throw new BadRequestException(
        'The city has no airport other than the origin.',
      );
    }
    return this.searchBetween(query, [origin], destinations);
  }

  private async searchBetween(
    query: Omit<SearchFlightsQueryDto, 'origin' | 'destination'>,
    origins: Airport[],
    destinations: Airport[],
  ): Promise<FlightSearchPage | RoundTripFlightSearchResult> {
    validatePriceRange(query);
    const passengers = validatePassengerCounts(
      query.adults ?? 1,
      query.children ?? 0,
      query.infants ?? 0,
    );
    const tripType = query.tripType ?? TripType.OneWay;
    if (tripType === TripType.RoundTrip) {
      if (!query.returnDate) {
        throw new BadRequestException(
          'returnDate is required for a round trip.',
        );
      }
      if (query.returnDate < query.departureDate) {
        throw new BadRequestException(
          'returnDate cannot be before departureDate.',
        );
      }
    } else if (query.returnDate) {
      throw new BadRequestException(
        'returnDate is only allowed for a round trip.',
      );
    }
    const common = {
      page: query.page ?? 1,
      passengers,
      cabinClass: query.cabinClass,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      sortBy: query.sortBy ?? FlightSortBy.DepartureTime,
      sortOrder: query.sortOrder ?? SortOrder.Asc,
    };
    const priceFilter =
      query.minPrice !== undefined || query.maxPrice !== undefined
        ? ' in this price range'
        : '';

    if (tripType === TripType.OneWay) {
      return this.searchLeg({
        ...common,
        origins,
        destinations,
        date: query.departureDate,
        emptyMessage: `No flights found${priceFilter}.`,
      });
    }

    const [outbound, inbound] = await Promise.all([
      this.searchLeg({
        ...common,
        origins,
        destinations,
        date: query.departureDate,
        emptyMessage: `No outbound flights found${priceFilter}.`,
      }),
      this.searchLeg({
        ...common,
        origins: destinations,
        destinations: origins,
        date: query.returnDate as string,
        emptyMessage: `No return flights found${priceFilter}.`,
      }),
    ]);
    return { tripType: TripType.RoundTrip, outbound, return: inbound };
  }

  private async searchLeg(leg: LegSearch): Promise<FlightSearchPage> {
    const flights = await this.flightModel
      .find({
        ...openFlightFilter(),
        departureAirport: { $in: leg.origins.map((a) => a.iataCode) },
        arrivalAirport: { $in: leg.destinations.map((a) => a.iataCode) },
        departureDate: leg.date,
      })
      .lean<LeanFlight[]>()
      .exec();

    // ACC-15: flights of deactivated airlines are hidden.
    const airlineIds = [...new Set(flights.map((f) => f.airlineId.toString()))];
    const airlines = await this.airlineModel
      .find({ _id: { $in: airlineIds }, active: true })
      .select('name code logoUrl')
      .lean<LeanAirline[]>()
      .exec();
    const airlineById = new Map(airlines.map((a) => [a._id.toString(), a]));

    const currency = platformCurrency(this.config);
    const items: FlightSearchItem[] = [];
    for (const flight of flights) {
      const airline = airlineById.get(flight.airlineId.toString());
      if (!airline) continue;
      const cabins = this.matchingCabins(flight.cabins, leg, currency);
      if (cabins.length === 0) continue;
      items.push(this.toItem(flight, airline, leg, cabins));
    }

    items.sort((a, b) =>
      compareFlightSearchResults(a, b, leg.sortBy, leg.sortOrder),
    );
    const start = (leg.page - 1) * DEFAULT_PAGE_SIZE;
    const page = paginate(
      items.slice(start, start + DEFAULT_PAGE_SIZE),
      items.length,
      leg.page,
    );
    return {
      ...page,
      seatsRequired: leg.passengers.seatsRequired,
      ...(items.length === 0 ? { message: leg.emptyMessage } : {}),
    };
  }

  private matchingCabins(
    cabins: LeanCabin[],
    leg: LegSearch,
    currency: string,
  ): FlightSearchCabin[] {
    const result: FlightSearchCabin[] = [];
    for (const cabin of cabins ?? []) {
      if (leg.cabinClass && cabin.cabinClass !== leg.cabinClass) continue;
      const availableSeats = seatsRemaining(cabin);
      if (availableSeats < leg.passengers.seatsRequired) continue;
      if (!isWithinPriceRange(cabin.price, leg)) continue;
      const { totalPrice, ...priceBreakdown } = calculatePassengerPricing(
        cabin.price,
        leg.passengers,
      );
      result.push({
        cabinId: cabin._id.toString(),
        cabinClass: cabin.cabinClass,
        price: cabin.price,
        availableSeats,
        freeBags: cabin.freeBags,
        maxBagWeightKg: cabin.maxBagWeightKg,
        priceBreakdown,
        totalPrice,
        currency,
      });
    }
    return result;
  }

  private toItem(
    flight: LeanFlight,
    airline: LeanAirline,
    leg: LegSearch,
    cabins: FlightSearchCabin[],
  ): FlightSearchItem {
    return {
      id: flight._id.toString(),
      flightNumber: flight.flightNumber,
      airline: toAirline(airline),
      departureAirport: toAirport(
        leg.origins.find((a) => a.iataCode === flight.departureAirport) ??
          leg.origins[0],
      ),
      arrivalAirport: toAirport(
        leg.destinations.find((a) => a.iataCode === flight.arrivalAirport) ??
          leg.destinations[0],
      ),
      departureLocal: utcToLocal(flight.departureAt, flight.departureTimeZone),
      arrivalLocal: utcToLocal(flight.arrivalAt, flight.arrivalTimeZone),
      departureUtcOffset: utcOffset(
        flight.departureAt,
        flight.departureTimeZone,
      ),
      arrivalUtcOffset: utcOffset(flight.arrivalAt, flight.arrivalTimeZone),
      departureAt: flight.departureAt,
      arrivalAt: flight.arrivalAt,
      durationMinutes: durationMinutes(flight.departureAt, flight.arrivalAt),
      cabins,
    };
  }
}

export function toAirline(airline: LeanAirline): FlightSearchAirline {
  return {
    id: airline._id.toString(),
    name: airline.name,
    code: airline.code,
    logoUrl: airline.logoUrl ?? null,
  };
}

export function toAirport(airport: Airport): FlightSearchAirport {
  return {
    iataCode: airport.iataCode,
    name: airport.name,
    cityId: airport.cityId,
    countryCode: airport.countryCode,
    timeZone: airport.timeZone,
  };
}
