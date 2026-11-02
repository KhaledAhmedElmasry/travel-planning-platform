// Requirement: FLT-17.
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Airline } from './placeholders/airline.schema';
import { Airport } from './placeholders/airport.schema';
import { Flight, FlightCabin } from './placeholders/flight.schema';
import {
  calculateSeatsRemaining,
  getBookableState,
  NO_CANCELLATION_REFUND_NOTE,
  orderCabinsByCategory,
  sortAndDescribeCancellationTiers,
} from './utils/flight-details.helpers';
import { calculateDurationMinutes } from './utils/flight-time';
import { toLocalIsoString } from './placeholders/local-time.placeholder';
import { SEAT_RESERVATION_PROVIDER } from './placeholders/seat-reservation-provider.placeholder';
import type { SeatReservationProvider } from './placeholders/seat-reservation-provider.placeholder';
import {
  FlightDetailsCabinDto,
  FlightDetailsResponseDto,
} from './dto/flight-details-response.dto';

type PopulatedAirport = Pick<
  Airport,
  'iataCode' | 'name' | 'city' | 'country' | 'timeZone'
> & { _id: string };

type PopulatedAirline = Pick<
  Airline,
  | 'name'
  | 'code'
  | 'logoUrl'
  | 'isActive'
  | 'baggagePolicy'
  | 'cancellationPolicy'
> & { _id: Types.ObjectId };

type FlightWithPopulatedReferences = Omit<
  Flight,
  'airline' | 'departureAirport' | 'arrivalAirport'
> & {
  _id: Types.ObjectId;
  airline: PopulatedAirline | null;
  departureAirport: PopulatedAirport | null;
  arrivalAirport: PopulatedAirport | null;
};

const AIRPORT_POPULATION_FIELDS =
  'iataCode name city country timeZone' as const;
const AIRLINE_POPULATION_FIELDS =
  'name code logoUrl isActive baggagePolicy cancellationPolicy' as const;

@Injectable()
export class FlightDetailsService {
  constructor(
    @InjectModel(Flight.name)
    private readonly flightModel: Model<Flight>,
    @Inject(SEAT_RESERVATION_PROVIDER)
    private readonly seatReservationProvider: SeatReservationProvider,
  ) {}

  async getFlightDetails(
    id: Types.ObjectId,
  ): Promise<FlightDetailsResponseDto> {
    // TODO(FLT-06 / FLT-05): Cancellation and rescheduling update live status/times, which this fresh read reflects.
    const flight = await this.flightModel
      .findById(id)
      .populate<{
        airline: PopulatedAirline | null;
        departureAirport: PopulatedAirport | null;
        arrivalAirport: PopulatedAirport | null;
      }>([
        { path: 'airline', select: AIRLINE_POPULATION_FIELDS },
        { path: 'departureAirport', select: AIRPORT_POPULATION_FIELDS },
        { path: 'arrivalAirport', select: AIRPORT_POPULATION_FIELDS },
      ])
      .lean<FlightWithPopulatedReferences | null>()
      .exec();

    if (!flight) {
      throw new NotFoundException('Flight not found.');
    }
    if (!flight.airline || !flight.departureAirport || !flight.arrivalAirport) {
      throw new InternalServerErrorException(
        'Flight airline or airport data is unavailable.',
      );
    }

    const flightId = flight._id.toString();
    const reservationsByFlight =
      await this.seatReservationProvider.getReservedSeats([flightId]);
    const reservations = reservationsByFlight.get(flightId);
    if (!reservations) {
      throw new InternalServerErrorException(
        `Seat reservation provider returned no counters for flight ${flightId}.`,
      );
    }

    const cabins = this.toCabinDtos(
      flight.cabins,
      reservations,
      flight.airline,
    );
    const tiers = sortAndDescribeCancellationTiers(
      flight.airline.cancellationPolicy?.tiers,
    );
    const bookable = getBookableState(
      flight.status,
      flight.airline.isActive,
      flight.departureUtc,
    );
    const baggagePolicy = flight.airline.baggagePolicy;

    return {
      id: flightId,
      airline: {
        id: flight.airline._id.toString(),
        name: flight.airline.name,
        code: flight.airline.code,
        logoUrl: flight.airline.logoUrl,
      },
      flightNumber: flight.flightNumber,
      status: flight.status,
      departureAirport: {
        id: String(flight.departureAirport._id),
        iataCode: flight.departureAirport.iataCode,
        name: flight.departureAirport.name,
        city: flight.departureAirport.city,
        country: flight.departureAirport.country,
        timeZone: flight.departureAirport.timeZone,
      },
      arrivalAirport: {
        id: String(flight.arrivalAirport._id),
        iataCode: flight.arrivalAirport.iataCode,
        name: flight.arrivalAirport.name,
        city: flight.arrivalAirport.city,
        country: flight.arrivalAirport.country,
        timeZone: flight.arrivalAirport.timeZone,
      },
      // Format each UTC instant in its own airport zone; do not use the server's local zone.
      departureLocal: toLocalIsoString(
        flight.departureUtc,
        flight.departureAirport.timeZone,
      ),
      arrivalLocal: toLocalIsoString(
        flight.arrivalUtc,
        flight.arrivalAirport.timeZone,
      ),
      departureUtc: flight.departureUtc.toISOString(),
      arrivalUtc: flight.arrivalUtc.toISOString(),
      durationMinutes: calculateDurationMinutes(
        flight.departureUtc,
        flight.arrivalUtc,
      ),
      cabins,
      extraBaggage: baggagePolicy
        ? {
            pricePerExtraBag: baggagePolicy.pricePerExtraBag,
            maxExtraBagsPerPassenger: baggagePolicy.maxExtraBagsPerPassenger,
            maxWeightKgPerBag: null,
          }
        : null,
      cancellationPolicy: {
        tiers,
        note: tiers.length === 0 ? NO_CANCELLATION_REFUND_NOTE : null,
      },
      bookable: bookable.bookable,
      bookableReason: bookable.bookableReason,
    };
  }

  private toCabinDtos(
    cabins: FlightCabin[],
    reservations: Record<string, { booked: number; held: number }>,
    airline: PopulatedAirline,
  ): FlightDetailsCabinDto[] {
    return orderCabinsByCategory(cabins).map((cabin) => {
      const cabinReservations = reservations[cabin.category];
      if (!cabinReservations) {
        throw new InternalServerErrorException(
          `Seat reservation provider returned no counters for cabin ${cabin.category}.`,
        );
      }
      const seatsRemaining = calculateSeatsRemaining(
        cabin.seatCount,
        cabinReservations.booked,
        cabinReservations.held,
      );
      const baggagePolicy = airline.baggagePolicy;
      return {
        category: cabin.category,
        price: cabin.price,
        seatsRemaining,
        soldOut: seatsRemaining === 0,
        freeBaggage: {
          bags: cabin.freeBags,
          maxWeightKgPerBag: cabin.maxBagWeightKg,
        },
        extraBaggage: baggagePolicy
          ? {
              pricePerExtraBag: baggagePolicy.pricePerExtraBag,
              maxExtraBagsPerPassenger: baggagePolicy.maxExtraBagsPerPassenger,
              maxWeightKgPerBag: cabin.maxBagWeightKg,
            }
          : null,
      };
    });
  }
}
