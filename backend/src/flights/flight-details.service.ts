// Requirement: FLT-17.
import {
  InternalServerErrorException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Airline } from './placeholders/airline.schema';
import { Airport } from './placeholders/airport.schema';
import {
  calculateSeatsRemaining,
  getBookableState,
  NO_CANCELLATION_REFUND_NOTE,
  orderCabinsByCategory,
  sortAndDescribeCancellationTiers,
} from './utils/flight-details.helpers';
import { calculateDurationMinutes } from './utils/flight-time';
import { toLocalIsoString } from './placeholders/local-time.placeholder';
import { Flight, FlightCabin } from './schemas/flight.schema';
import {
  FlightDetailsCabinDto,
  FlightDetailsResponseDto,
} from './dto/flight-details-response.dto';

type PopulatedAirport = Pick<
  Airport,
  'iataCode' | 'name' | 'cityId' | 'countryCode' | 'timeZone'
> & { _id: string };

type PopulatedAirline = Pick<
  Airline,
  | 'name'
  | 'code'
  | 'logoUrl'
  | 'active'
  | 'extraBagPrice'
  | 'maxExtraBagsPerPassenger'
  | 'cancellationTiers'
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
  'iataCode name cityId countryCode timeZone' as const;
const AIRLINE_POPULATION_FIELDS =
  'name code logoUrl active extraBagPrice maxExtraBagsPerPassenger cancellationTiers' as const;

@Injectable()
export class FlightDetailsService {
  constructor(
    @InjectModel(Flight.name)
    private readonly flightModel: Model<Flight>,
  ) {}

  async getFlightDetails(
    id: Types.ObjectId,
  ): Promise<FlightDetailsResponseDto> {
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

    const cabins = this.toCabinDtos(flight.cabins, flight.airline);
    const tiers = sortAndDescribeCancellationTiers(
      flight.airline.cancellationTiers,
    );
    const bookable = getBookableState(
      flight.status,
      flight.airline.active,
      flight.departureAt,
    );

    return {
      id: flight._id.toString(),
      airline: {
        id: flight.airline._id.toString(),
        name: flight.airline.name,
        code: flight.airline.code,
        logoUrl: flight.airline.logoUrl,
      },
      flightNumber: flight.flightNumber,
      status: flight.status,
      departureAirport: this.toAirportDto(flight.departureAirport),
      arrivalAirport: this.toAirportDto(flight.arrivalAirport),
      departureLocal: toLocalIsoString(
        flight.departureAt,
        flight.departureAirport.timeZone,
      ),
      arrivalLocal: toLocalIsoString(
        flight.arrivalAt,
        flight.arrivalAirport.timeZone,
      ),
      departureUtc: flight.departureAt.toISOString(),
      arrivalUtc: flight.arrivalAt.toISOString(),
      durationMinutes: calculateDurationMinutes(
        flight.departureAt,
        flight.arrivalAt,
      ),
      cabins,
      extraBaggage: this.toExtraBaggageDto(flight.airline),
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
    airline: PopulatedAirline,
  ): FlightDetailsCabinDto[] {
    return orderCabinsByCategory(cabins).map((cabin) => {
      const seatsRemaining = calculateSeatsRemaining(
        cabin.total,
        cabin.booked,
        cabin.held,
      );
      return {
        category: cabin.cabinClass,
        price: cabin.price,
        seatsRemaining,
        soldOut: seatsRemaining === 0,
        freeBaggage: {
          bags: cabin.freeBags,
          maxWeightKgPerBag: cabin.maxBagWeightKg,
        },
        extraBaggage: this.toExtraBaggageDto(airline, cabin.maxBagWeightKg),
      };
    });
  }

  private toExtraBaggageDto(
    airline: PopulatedAirline,
    maxWeightKgPerBag: number | null = null,
  ) {
    return {
      pricePerExtraBag: airline.extraBagPrice,
      maxExtraBagsPerPassenger: airline.maxExtraBagsPerPassenger,
      maxWeightKgPerBag,
    };
  }

  private toAirportDto(airport: PopulatedAirport) {
    return {
      id: String(airport._id),
      iataCode: airport.iataCode,
      name: airport.name,
      cityId: airport.cityId,
      countryCode: airport.countryCode,
      timeZone: airport.timeZone,
    };
  }
}
