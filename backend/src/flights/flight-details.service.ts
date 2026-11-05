// Area: Flight Search & Booking
// Requirements: FLT-17, GEN-06, FLT-08, FLT-09, PAY-04, NEW-04.
//
// GET /api/flights/:id (everyone, including guests): airline, flight number, airports, local
// departure and arrival times with time zones and UTC offsets (GEN-06), duration, status, each
// cabin with its fare, seats remaining and free baggage, the extra-baggage policy (FLT-08) and
// the airline's cancellation tiers (FLT-09). Cancelled and departed flights are still shown, with
// bookable: false. A flight of a deactivated airline is hidden (404, ACC-15).
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Airline } from '../airlines/schemas/airline.schema';
import { platformCurrency } from '../payments/platform-currency';
import { ReferenceDataService } from '../reference-data/reference-data.service';
import { Airport } from '../reference-data/schemas/reference-data.schema';
import { FlightDetails } from './dto/flight-details-response.dto';
import { toAirline, toAirport } from './flight-search.service';
import { utcOffset, utcToLocal } from './flight-time';
import { Cabin, Flight } from './schemas/flight.schema';
import {
  bookableState,
  describeCancellationTiers,
  durationMinutes,
  NO_CANCELLATION_REFUND_NOTE,
  orderCabins,
  seatsRemaining,
} from './utils/flight-details.helpers';

type LeanFlight = Flight & { _id: Types.ObjectId };
type LeanAirline = Airline & { _id: Types.ObjectId };
type LeanCabin = Cabin & { _id: Types.ObjectId };

const FLIGHT_NOT_FOUND = 'Flight not found.';

@Injectable()
export class FlightDetailsService {
  constructor(
    @InjectModel(Flight.name) private readonly flightModel: Model<Flight>,
    @InjectModel(Airline.name) private readonly airlineModel: Model<Airline>,
    private readonly referenceData: ReferenceDataService,
    private readonly config: ConfigService,
  ) {}

  async getFlightDetails(id: Types.ObjectId): Promise<FlightDetails> {
    const flight = await this.flightModel
      .findById(id)
      .lean<LeanFlight>()
      .exec();
    if (!flight) throw new NotFoundException(FLIGHT_NOT_FOUND);

    const airline = await this.airlineModel
      .findOne({ _id: flight.airlineId, active: true })
      .lean<LeanAirline>()
      .exec();
    if (!airline) throw new NotFoundException(FLIGHT_NOT_FOUND);

    const [from, to] = await Promise.all([
      this.referenceData.findAirport(flight.departureAirport),
      this.referenceData.findAirport(flight.arrivalAirport),
    ]);

    const tiers = describeCancellationTiers(airline.cancellationTiers);
    return {
      id: flight._id.toString(),
      airline: toAirline(airline),
      flightNumber: flight.flightNumber,
      status: flight.status,
      departureAirport: airportOrCode(
        from,
        flight.departureAirport,
        flight.departureTimeZone,
      ),
      arrivalAirport: airportOrCode(
        to,
        flight.arrivalAirport,
        flight.arrivalTimeZone,
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
      cabins: orderCabins(flight.cabins as unknown as LeanCabin[]).map(
        (cabin) => {
          const remaining = seatsRemaining(cabin);
          return {
            cabinId: cabin._id.toString(),
            cabinClass: cabin.cabinClass,
            price: cabin.price,
            seatsRemaining: remaining,
            soldOut: remaining === 0,
            freeBags: cabin.freeBags,
            maxBagWeightKg: cabin.maxBagWeightKg,
          };
        },
      ),
      extraBaggage: {
        extraBagPrice: airline.extraBagPrice ?? null,
        maxExtraBagsPerPassenger: airline.maxExtraBagsPerPassenger ?? 0,
      },
      cancellationPolicy: {
        tiers,
        note: tiers.length === 0 ? NO_CANCELLATION_REFUND_NOTE : null,
      },
      ...bookableState(flight),
      currency: platformCurrency(this.config),
    };
  }
}

// The airport from the list; if it was ever removed from the list, the code and the time zone
// stored on the flight are still shown.
function airportOrCode(
  airport: Airport | null,
  code: string,
  timeZone: string,
) {
  return airport
    ? toAirport(airport)
    : { iataCode: code, name: code, cityId: '', countryCode: '', timeZone };
}
