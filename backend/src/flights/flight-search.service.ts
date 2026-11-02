// Requirements: FLT-11, GEN-04, GEN-05, GEN-06, GEN-13.
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  FlightSearchQueryDto,
  FLIGHT_SEARCH_PAGE_SIZE,
} from './dto/flight-search-query.dto';
import {
  FlightSearchAirlineDto,
  FlightSearchAirportDto,
  FlightSearchCabinDto,
  FlightSearchItemDto,
  FlightSearchResponseDto,
} from './dto/flight-search-response.dto';
// TODO(AREA-5): Replace these placeholder model types with Area 5's merged schema exports.
import { Airline } from './placeholders/airline.schema';
import { Airport } from './placeholders/airport.schema';
import { Flight, FlightCabin } from './placeholders/flight.schema';
// TODO(AREA-5): Replace the local-time placeholder import with Area 5's shared helper.
import {
  getUtcRangeForLocalDate,
  toLocalIsoString,
} from './placeholders/local-time.placeholder';
// TODO(AREA-3): Replace this placeholder with Area 3's shared pagination response type.
import { PaginatedResponse } from './placeholders/paginated-response.placeholder';
// TODO(AREA-1): The module binds this token to a placeholder until Area 1's provider is merged.
import { SEAT_RESERVATION_PROVIDER } from './placeholders/seat-reservation-provider.placeholder';
import type { SeatReservationProvider } from './placeholders/seat-reservation-provider.placeholder';

type PopulatedAirline = Pick<Airline, 'name' | 'logoUrl' | 'isActive'> & {
  _id: Types.ObjectId;
};

type SearchFlight = Omit<Flight, 'airline'> & {
  _id: Types.ObjectId;
  airline: PopulatedAirline | null;
};

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

  async search(query: FlightSearchQueryDto): Promise<FlightSearchResponseDto> {
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

    const { startUtc, endUtc } = getUtcRangeForLocalDate(
      query.date,
      departureAirport.timeZone,
    );
    // TODO(FLT-12): Add the return-date leg when implementing round-trip search.

    const flights = await this.flightModel
      .find({
        departureAirport: departureAirport._id,
        arrivalAirport: arrivalAirport._id,
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

    // One provider call batches counters for the candidate flights instead of querying per flight.
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
        query.passengers,
      );
      if (cabins.length === 0) {
        return [];
      }

      return [
        this.toSearchItem(
          flight,
          flight.airline,
          departureAirport,
          arrivalAirport,
          cabins,
        ),
      ];
    });

    // TODO(FLT-15): Apply price/cabin filters and sort overrides here; ascending departure is the default.
    items.sort(
      (first, second) =>
        first.departureUtc.getTime() - second.departureUtc.getTime() ||
        first.flightId.localeCompare(second.flightId),
    );

    const total = items.length;
    const limit = FLIGHT_SEARCH_PAGE_SIZE;
    const offset = (query.page - 1) * limit;
    const response: FlightSearchResponseDto &
      PaginatedResponse<FlightSearchItemDto> = {
      items: items.slice(offset, offset + limit),
      total,
      page: query.page,
      limit,
      totalPages: Math.ceil(total / limit),
      ...(total === 0 && {
        message: 'No flights found for your search.',
      }),
    };
    return response;
  }

  private getAvailableCabins(
    cabins: FlightCabin[],
    reservations: Record<string, { booked: number; held: number }>,
    passengerCount: number,
  ): FlightSearchCabinDto[] {
    return cabins.flatMap((cabin) => {
      const cabinReservations = reservations[cabin.category];
      if (!cabinReservations) {
        throw new InternalServerErrorException(
          `Seat reservation provider returned no counters for cabin ${cabin.category}.`,
        );
      }
      // Reserved seats include confirmed bookings and live holds; both reduce sellable capacity.
      const availableSeats =
        cabin.seatCount - cabinReservations.booked - cabinReservations.held;
      return availableSeats >= passengerCount
        ? [
            {
              category: cabin.category,
              price: cabin.price,
              availableSeats,
              freeBags: cabin.freeBags,
              maxBagWeightKg: cabin.maxBagWeightKg,
            },
          ]
        : [];
    });
  }

  private toSearchItem(
    flight: SearchFlight,
    airline: PopulatedAirline,
    departureAirport: Airport & { _id: string },
    arrivalAirport: Airport & { _id: string },
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
      durationMinutes: Math.round(
        (flight.arrivalUtc.getTime() - flight.departureUtc.getTime()) / 60_000,
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

  private toAirportDto(
    airport: Airport & { _id: string },
  ): FlightSearchAirportDto {
    return {
      iataCode: airport.iataCode,
      name: airport.name,
      city: airport.city,
      timeZone: airport.timeZone,
    };
  }
}
