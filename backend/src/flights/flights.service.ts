import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AirlinesService } from '../airlines/airlines.service';
import { Role } from '../common/enums';
import type { AuthUser } from '../common/interfaces';
import { ReferenceDataService } from '../reference-data/reference-data.service';
import { CreateFlightDto } from './dto/create-flight.dto';
import { localToUtc, utcToLocal, utcToLocalDate } from './flight-time';
import { Flight, FlightDocument, FlightStatus } from './schemas/flight.schema';

// One cabin in a flight response (FLT-04).
export interface CabinResponse {
  id: string;
  cabinClass: string;
  seats: number;
  bookedSeats: number;
  heldSeats: number;
  availableSeats: number;
  price: number;
  freeBags: number;
  maxBagWeightKg: number;
}

// What the flight endpoints return: local times at each airport and the UTC times (GEN-06).
export interface FlightResponse {
  id: string;
  airlineId: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTimeZone: string;
  arrivalTimeZone: string;
  departureLocal: string;
  arrivalLocal: string;
  departureAt: Date;
  arrivalAt: Date;
  durationMinutes: number;
  status: FlightStatus;
  cabins: CabinResponse[];
  createdAt?: Date;
  updatedAt?: Date;
}

// MongoDB error 11000: the unique index { airlineId, flightNumber, departureDate } was broken.
function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

const DUPLICATE_FLIGHT =
  'The airline already has this flight number on that departure date.';

// Area: Airlines & Flight Inventory
// Business logic and database access for: FLT-03, FLT-04, FLT-05, FLT-06, FLT-17, FLT-29, FLT-30, GEN-06, NEW-02
// Scheduled job needed: mark flights Departed once departure time has passed (FLT-30).
@Injectable()
export class FlightsService {
  constructor(
    @InjectModel(Flight.name)
    private readonly flightModel: Model<FlightDocument>,
    private readonly airlinesService: AirlinesService,
    private readonly referenceData: ReferenceDataService,
  ) {}

  // FLT-03: an airline moderator creates a flight for their own airline. Local times are
  // converted to UTC with each airport's time zone (GEN-06). The flight starts as Scheduled
  // (FLT-30) with no cabins; cabins are added with POST /api/flights/:id/cabins (FLT-04).
  async create(user: AuthUser, dto: CreateFlightDto): Promise<FlightResponse> {
    if (user.role !== Role.AirlineModerator || !user.airlineId) {
      throw new ForbiddenException('Not an airline moderator.');
    }
    // 403 if the airline was deactivated (ACC-15).
    const airline = await this.airlinesService.findManagedAirline(
      user,
      user.airlineId,
    );

    if (dto.departureAirport === dto.arrivalAirport) {
      throw new BadRequestException(
        'The departure and arrival airports must be different.',
      );
    }
    // FLT-02: only airports from the airport list.
    const from = await this.referenceData.assertAirport(dto.departureAirport);
    const to = await this.referenceData.assertAirport(dto.arrivalAirport);

    const departureAt = localToUtc(
      dto.departureLocal,
      from.timeZone,
      'departureLocal',
    );
    const arrivalAt = localToUtc(dto.arrivalLocal, to.timeZone, 'arrivalLocal');

    if (departureAt.getTime() <= Date.now()) {
      throw new BadRequestException('The departure must be in the future.');
    }
    if (arrivalAt.getTime() <= departureAt.getTime()) {
      throw new BadRequestException(
        'The arrival must be after the departure (compared in UTC).',
      );
    }

    const departureDate = utcToLocalDate(departureAt, from.timeZone);
    const duplicate = await this.flightModel.exists({
      airlineId: airline._id,
      flightNumber: dto.flightNumber,
      departureDate,
    });
    if (duplicate) throw new ConflictException(DUPLICATE_FLIGHT);

    try {
      const flight = await this.flightModel.create({
        airlineId: airline._id,
        flightNumber: dto.flightNumber,
        departureAirport: from.iataCode,
        arrivalAirport: to.iataCode,
        departureTimeZone: from.timeZone,
        arrivalTimeZone: to.timeZone,
        departureAt,
        arrivalAt,
        departureDate,
        status: FlightStatus.Scheduled,
        cabins: [],
      });
      return this.toResponse(flight);
    } catch (err) {
      if (isDuplicateKeyError(err))
        throw new ConflictException(DUPLICATE_FLIGHT);
      throw err;
    }
  }

  // GEN-06: the flight with local times at each airport and the UTC times.
  toResponse(flight: FlightDocument): FlightResponse {
    return {
      id: flight._id.toString(),
      airlineId: flight.airlineId.toString(),
      flightNumber: flight.flightNumber,
      departureAirport: flight.departureAirport,
      arrivalAirport: flight.arrivalAirport,
      departureTimeZone: flight.departureTimeZone,
      arrivalTimeZone: flight.arrivalTimeZone,
      departureLocal: utcToLocal(flight.departureAt, flight.departureTimeZone),
      arrivalLocal: utcToLocal(flight.arrivalAt, flight.arrivalTimeZone),
      departureAt: flight.departureAt,
      arrivalAt: flight.arrivalAt,
      durationMinutes: Math.round(
        (flight.arrivalAt.getTime() - flight.departureAt.getTime()) / 60000,
      ),
      status: flight.status,
      cabins: (flight.cabins ?? []).map((c) => ({
        id: c._id.toString(),
        cabinClass: c.cabinClass,
        seats: c.total,
        bookedSeats: c.booked,
        heldSeats: c.held,
        availableSeats: Math.max(0, c.total - c.booked - c.held),
        price: c.price,
        freeBags: c.freeBags,
        maxBagWeightKg: c.maxBagWeightKg,
      })),
      createdAt: flight.createdAt,
      updatedAt: flight.updatedAt,
    };
  }
}
