// Requirements: FLT-11, FLT-12, GEN-04, GEN-05, GEN-06, GEN-13.
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CabinClass } from '../common/enums';
import {
  DEFAULT_FLIGHT_SEARCH_PAGE,
  FlightSearchQueryDto,
  FlightSearchTripType,
  FLIGHT_SEARCH_PAGE_SIZE,
} from './dto/flight-search-query.dto';
import {
  FlightSearchAirlineDto,
  FlightSearchAirportDto,
  FlightSearchCabinDto,
  FlightSearchItemDto,
  FlightSearchResponseDto,
  RoundTripFlightSearchResponseDto,
} from './dto/flight-search-response.dto';
import { Airline } from './placeholders/airline.schema';
import { Airport } from './placeholders/airport.schema';
import {
  getUtcRangeForLocalDate,
  toLocalIsoString,
} from './placeholders/local-time.placeholder';
import { PaginatedResponse } from './placeholders/paginated-response.placeholder';
import { Flight, FlightCabin } from './schemas/flight.schema';
import {
  calculatePassengerPricing,
  validatePassengerCounts,
  type PassengerCounts,
} from './utils/passenger-pricing';
import { calculateDurationMinutes } from './utils/flight-time';
import {
  compareFlightSearchResults,
  FlightSortBy,
  FlightSortOrder,
  isWithinPriceRange,
  validatePriceRange,
} from './utils/flight-sorting';

type PopulatedAirline = Pick<Airline, 'name' | 'logoUrl' | 'active'> & {
  _id: Types.ObjectId;
};

type SearchFlight = Omit<Flight, 'airline'> & {
  _id: Types.ObjectId;
  airline: PopulatedAirline | null;
};

type SearchAirport = Airport & { _id: Types.ObjectId | string };

@Injectable()
export class FlightSearchService {
  constructor(
    @InjectModel(Airport.name)
    private readonly airportModel: Model<Airport>,
    @InjectModel(Flight.name)
    private readonly flightModel: Model<Flight>,
  ) {}

  search(
    query: FlightSearchQueryDto & {
      tripType: FlightSearchTripType.RoundTrip;
    },
  ): Promise<RoundTripFlightSearchResponseDto>;
  search(
    query: FlightSearchQueryDto & {
      tripType?: FlightSearchTripType.OneWay;
    },
  ): Promise<FlightSearchResponseDto>;
  search(
    query: FlightSearchQueryDto,
  ): Promise<FlightSearchResponseDto | RoundTripFlightSearchResponseDto>;
  async search(
    query: FlightSearchQueryDto,
  ): Promise<FlightSearchResponseDto | RoundTripFlightSearchResponseDto> {
    validatePriceRange(query);
    const hasPriceFilter =
      query.minPrice !== undefined || query.maxPrice !== undefined;
    const sortBy = query.sortBy ?? FlightSortBy.DepartureTime;
    const sortOrder = query.sortOrder ?? FlightSortOrder.Ascending;
    const tripType = query.tripType ?? FlightSearchTripType.OneWay;
    const [departureAirport, arrivalAirport] = await Promise.all([
      this.airportModel.findOne({ iataCode: query.origin }).lean().exec(),
      this.airportModel.findOne({ iataCode: query.destination }).lean().exec(),
    ]);

    if (!departureAirport) {
      throw new BadRequestException(
        `Unknown departure airport code: ${query.origin}.`,
      );
    }
    if (!arrivalAirport) {
      throw new BadRequestException(
        `Unknown arrival airport code: ${query.destination}.`,
      );
    }
    if (String(departureAirport._id) === String(arrivalAirport._id)) {
      throw new BadRequestException(
        'Departure and arrival airports must be different.',
      );
    }

    const passengers = validatePassengerCounts(
      query.adults ?? 1,
      query.children ?? 0,
      query.infants ?? 0,
    );
    const page = query.page ?? DEFAULT_FLIGHT_SEARCH_PAGE;

    if (tripType === FlightSearchTripType.RoundTrip) {
      if (!query.returnDate) {
        throw new BadRequestException(
          'returnDate is required for a round-trip search.',
        );
      }
      if (query.returnDate < query.departureDate) {
        throw new BadRequestException(
          'returnDate cannot be earlier than the departure date.',
        );
      }

      const [outbound, returnFlights] = await Promise.all([
        this.searchLeg({
          origin: departureAirport,
          destination: arrivalAirport,
          date: query.departureDate,
          page,
          passengers,
          cabinClass: query.cabinClass,
          minPrice: query.minPrice,
          maxPrice: query.maxPrice,
          sortBy,
          sortOrder,
          emptyMessage: hasPriceFilter
            ? 'No outbound flights found for your search and price range.'
            : 'No outbound flights found for your search.',
        }),
        this.searchLeg({
          origin: arrivalAirport,
          destination: departureAirport,
          date: query.returnDate,
          page,
          passengers,
          cabinClass: query.cabinClass,
          minPrice: query.minPrice,
          maxPrice: query.maxPrice,
          sortBy,
          sortOrder,
          emptyMessage: hasPriceFilter
            ? 'No return flights found for your search and price range.'
            : 'No return flights found for your search.',
        }),
      ]);
      return {
        tripType: FlightSearchTripType.RoundTrip,
        outbound,
        return: returnFlights,
      };
    }

    if (query.returnDate) {
      throw new BadRequestException(
        'returnDate can only be provided for a round-trip search.',
      );
    }

    return this.searchLeg({
      origin: departureAirport,
      destination: arrivalAirport,
      date: query.departureDate,
      page,
      passengers,
      cabinClass: query.cabinClass,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      sortBy,
      sortOrder,
      emptyMessage: hasPriceFilter
        ? 'No flights found for your search and price range.'
        : 'No flights found for your search.',
    });
  }

  private async searchLeg(parameters: {
    origin: SearchAirport;
    destination: SearchAirport;
    date: string;
    page: number;
    passengers: PassengerCounts;
    cabinClass?: CabinClass;
    minPrice?: number;
    maxPrice?: number;
    sortBy: FlightSortBy;
    sortOrder: FlightSortOrder;
    emptyMessage: string;
  }): Promise<FlightSearchResponseDto> {
    const { startUtc, endUtc } = getUtcRangeForLocalDate(
      parameters.date,
      parameters.origin.timeZone,
    );
    const now = new Date();
    const flights = await this.flightModel
      .find({
        departureAirport: parameters.origin._id,
        arrivalAirport: parameters.destination._id,
        status: 'scheduled',
        departureAt: { $gte: startUtc, $lt: endUtc, $gt: now },
      })
      .populate<{ airline: PopulatedAirline | null }>({
        path: 'airline',
        match: { active: true },
        select: 'name logoUrl active',
      })
      .lean<SearchFlight[]>()
      .exec();

    const items = flights.flatMap((flight) => {
      if (!flight.airline) {
        return [];
      }
      const cabins = this.getAvailableCabins(
        flight.cabins,
        parameters.passengers,
        parameters.cabinClass,
        parameters,
      );
      return cabins.length === 0
        ? []
        : [
            this.toSearchItem(
              flight,
              flight.airline,
              parameters.origin,
              parameters.destination,
              cabins,
            ),
          ];
    });

    items.sort((first, second) =>
      compareFlightSearchResults(
        first,
        second,
        parameters.sortBy,
        parameters.sortOrder,
      ),
    );

    const total = items.length;
    const limit = FLIGHT_SEARCH_PAGE_SIZE;
    const offset = (parameters.page - 1) * limit;
    const response: FlightSearchResponseDto &
      PaginatedResponse<FlightSearchItemDto> = {
      items: items.slice(offset, offset + limit),
      total,
      page: parameters.page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
      seatsRequired: parameters.passengers.seatsRequired,
      ...(total === 0 && { message: parameters.emptyMessage }),
    };
    return response;
  }

  private getAvailableCabins(
    cabins: FlightCabin[],
    passengers: PassengerCounts,
    cabinClass?: CabinClass,
    priceRange: { minPrice?: number; maxPrice?: number } = {},
  ): FlightSearchCabinDto[] {
    return cabins.flatMap((cabin) => {
      if (cabinClass && cabin.cabinClass !== cabinClass) {
        return [];
      }
      const availableSeats = cabin.total - cabin.booked - cabin.held;
      if (availableSeats < passengers.seatsRequired) {
        return [];
      }
      if (!isWithinPriceRange(cabin.price, priceRange)) {
        return [];
      }
      const pricing = calculatePassengerPricing(cabin.price, passengers);
      return [
        {
          category: cabin.cabinClass,
          price: cabin.price,
          priceBreakdown: {
            adultFare: pricing.adultFare,
            childFare: pricing.childFare,
            infantFare: pricing.infantFare,
            adultsSubtotal: pricing.adultsSubtotal,
            childrenSubtotal: pricing.childrenSubtotal,
            infantsSubtotal: pricing.infantsSubtotal,
          },
          totalPrice: pricing.totalPrice,
          availableSeats,
          freeBags: cabin.freeBags,
          maxBagWeightKg: cabin.maxBagWeightKg,
        },
      ];
    });
  }

  private toSearchItem(
    flight: SearchFlight,
    airline: PopulatedAirline,
    departureAirport: SearchAirport,
    arrivalAirport: SearchAirport,
    cabins: FlightSearchCabinDto[],
  ): FlightSearchItemDto {
    return {
      flightId: flight._id.toString(),
      flightNumber: flight.flightNumber,
      airline: this.toAirlineDto(airline),
      departureAirport: this.toAirportDto(departureAirport),
      arrivalAirport: this.toAirportDto(arrivalAirport),
      departureLocal: toLocalIsoString(
        flight.departureAt,
        departureAirport.timeZone,
      ),
      arrivalLocal: toLocalIsoString(flight.arrivalAt, arrivalAirport.timeZone),
      departureUtc: flight.departureAt,
      arrivalUtc: flight.arrivalAt,
      durationMinutes: calculateDurationMinutes(
        flight.departureAt,
        flight.arrivalAt,
      ),
      cabins,
    };
  }

  private toAirlineDto(airline: PopulatedAirline): FlightSearchAirlineDto {
    return {
      id: airline._id.toString(),
      name: airline.name,
      logoUrl: airline.logoUrl,
    };
  }

  private toAirportDto(airport: SearchAirport): FlightSearchAirportDto {
    return {
      iataCode: airport.iataCode,
      name: airport.name,
      cityId: airport.cityId,
      countryCode: airport.countryCode,
      timeZone: airport.timeZone,
    };
  }
}
