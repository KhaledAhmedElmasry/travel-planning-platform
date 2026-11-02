// Requirements: FLT-11, FLT-12, GEN-04, GEN-05, GEN-06, GEN-13.
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
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
// TODO(AREA-5): Replace these placeholder model types with Area 5's merged schema exports.
import { Airline } from './placeholders/airline.schema';
import { Airport } from './placeholders/airport.schema';
import {
  CabinCategory,
  Flight,
  FlightCabin,
} from './placeholders/flight.schema';
// TODO(AREA-5): Replace the local-time placeholder import with Area 5's shared helper.
import {
  getUtcRangeForLocalDate,
  toLocalIsoString,
} from './placeholders/local-time.placeholder';
// TODO(AREA-3): Replace this placeholder with Area 3's shared pagination response type.
import { PaginatedResponse } from './placeholders/paginated-response.placeholder';
// TODO(AREA-1): Replace the placeholder provider binding when Area 1's batched provider is merged.
import { SEAT_RESERVATION_PROVIDER } from './placeholders/seat-reservation-provider.placeholder';
import type { SeatReservationProvider } from './placeholders/seat-reservation-provider.placeholder';
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

const CABIN_CATEGORY_BY_CLASS: Record<CabinClass, CabinCategory> = {
  [CabinClass.Economy]: 'Economy',
  [CabinClass.PremiumEconomy]: 'Premium Economy',
  [CabinClass.Business]: 'Business',
  [CabinClass.First]: 'First',
};

type PopulatedAirline = Pick<Airline, 'name' | 'logoUrl' | 'isActive'> & {
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
    @Inject(SEAT_RESERVATION_PROVIDER)
    private readonly seatReservationProvider: SeatReservationProvider,
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
      this.airportModel.findOne({ iataCode: query.from }).lean().exec(),
      this.airportModel.findOne({ iataCode: query.to }).lean().exec(),
    ]);

    if (!departureAirport) {
      throw new BadRequestException(
        `Unknown departure airport code: ${query.from}.`,
      );
    }
    if (!arrivalAirport) {
      throw new BadRequestException(
        `Unknown arrival airport code: ${query.to}.`,
      );
    }
    if (String(departureAirport._id) === String(arrivalAirport._id)) {
      throw new BadRequestException(
        'Departure and arrival airports must be different.',
      );
    }

    const passengers = validatePassengerCounts(
      query.adults ?? query.passengers ?? 0,
      query.children ?? 0,
      query.infants ?? 0,
    );

    if (tripType === FlightSearchTripType.RoundTrip) {
      if (!query.returnDate) {
        throw new BadRequestException(
          'returnDate is required for a round-trip search.',
        );
      }
      if (query.returnDate < query.date) {
        throw new BadRequestException(
          'returnDate cannot be earlier than the departure date.',
        );
      }

      // The return leg departs from the original arrival airport; booking validates leg chronology.
      // TODO(FLT-12): Booking must verify the return flight departs after the outbound flight arrives.
      // Price bounds are applied independently to each leg, not to the combined trip total.
      const [outbound, returnFlights] = await Promise.all([
        this.searchLeg({
          origin: departureAirport,
          destination: arrivalAirport,
          date: query.date,
          page: query.page ?? DEFAULT_FLIGHT_SEARCH_PAGE,
          passengers,
          cabin: query.cabin,
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
          page: query.returnPage ?? DEFAULT_FLIGHT_SEARCH_PAGE,
          passengers,
          cabin: query.cabin,
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
      date: query.date,
      page: query.page ?? DEFAULT_FLIGHT_SEARCH_PAGE,
      passengers,
      cabin: query.cabin,
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
    cabin?: CabinClass;
    minPrice?: number;
    maxPrice?: number;
    sortBy: FlightSortBy;
    sortOrder: FlightSortOrder;
    emptyMessage: string;
  }): Promise<FlightSearchResponseDto> {
    // Each leg's departure airport defines its local calendar day and UTC range.
    const { startUtc, endUtc } = getUtcRangeForLocalDate(
      parameters.date,
      parameters.origin.timeZone,
    );
    const flights = await this.flightModel
      .find({
        departureAirport: parameters.origin._id,
        arrivalAirport: parameters.destination._id,
        status: 'Scheduled',
        departureUtc: { $gte: startUtc, $lt: endUtc },
      })
      .populate<{ airline: PopulatedAirline | null }>({
        path: 'airline',
        match: { isActive: true },
        select: 'name logoUrl isActive',
      })
      .lean<SearchFlight[]>()
      .exec();

    // Fetch all seat counters for this leg in one batch, never once per flight.
    const reservedSeats = await this.seatReservationProvider.getReservedSeats(
      flights
        .filter((flight) => flight.airline !== null)
        .map((flight) => flight._id.toString()),
    );
    const items = flights.flatMap((flight) => {
      if (!flight.airline) {
        return [];
      }
      const reservations = reservedSeats.get(flight._id.toString());
      if (!reservations) {
        throw new InternalServerErrorException(
          `Seat reservation provider returned no counters for flight ${flight._id.toString()}.`,
        );
      }
      const cabins = this.getAvailableCabins(
        flight.cabins,
        reservations,
        parameters.passengers,
        parameters.cabin,
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

    // The seat provider filters cabins in memory, so sorting after it is necessary today.
    // TODO(FLT-15): Replace with a database-level sort if seat-availability filtering moves there.
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
    reservations: Record<string, { booked: number; held: number }>,
    passengers: PassengerCounts,
    cabinFilter?: CabinClass,
    priceRange: { minPrice?: number; maxPrice?: number } = {},
  ): FlightSearchCabinDto[] {
    return cabins.flatMap((cabin) => {
      // Compare the shared lowercase CabinClass with the placeholder display categories.
      if (
        cabinFilter &&
        cabin.category !== CABIN_CATEGORY_BY_CLASS[cabinFilter]
      ) {
        return [];
      }
      const cabinReservations = reservations[cabin.category];
      if (!cabinReservations) {
        throw new InternalServerErrorException(
          `Seat reservation provider returned no counters for cabin ${cabin.category}.`,
        );
      }
      // Reserved seats include confirmed bookings and live holds; both reduce sellable capacity.
      const availableSeats =
        cabin.seatCount - cabinReservations.booked - cabinReservations.held;
      if (availableSeats < passengers.seatsRequired) {
        return [];
      }
      const pricing = calculatePassengerPricing(cabin.price, passengers);
      // Filter the total shown to the user, including the infant's 10% fare.
      if (!isWithinPriceRange(pricing.totalPrice, priceRange)) {
        return [];
      }
      return [
        {
          category: cabin.category,
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
        flight.departureUtc,
        departureAirport.timeZone,
      ),
      arrivalLocal: toLocalIsoString(
        flight.arrivalUtc,
        arrivalAirport.timeZone,
      ),
      departureUtc: flight.departureUtc,
      arrivalUtc: flight.arrivalUtc,
      durationMinutes: calculateDurationMinutes(
        flight.departureUtc,
        flight.arrivalUtc,
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
      city: airport.city,
      timeZone: airport.timeZone,
    };
  }
}
