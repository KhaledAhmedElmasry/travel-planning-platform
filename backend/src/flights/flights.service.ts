import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { AirlinesService } from '../airlines/airlines.service';
import { BookingStatus, Role } from '../common/enums';
import {
  FlightBookingLifecycleService,
  FlightCancellationResult,
} from '../flight-bookings/flight-booking-lifecycle.service';
import {
  FlightBooking,
  FlightBookingDocument,
} from '../flight-bookings/schemas/flight-booking.schema';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthUser } from '../common/interfaces';
import { ReferenceDataService } from '../reference-data/reference-data.service';
import { CreateCabinDto } from './dto/create-cabin.dto';
import { CreateFlightDto } from './dto/create-flight.dto';
import { UpdateCabinDto } from './dto/update-cabin.dto';
import { UpdateFlightDto } from './dto/update-flight.dto';
import {
  FlightManifestStatus,
  ListFlightManifestQueryDto,
} from './dto/list-flight-manifest-query.dto';
import {
  DEFAULT_PAGE_SIZE,
  getPaginationOffset,
  PaginatedList,
  paginate,
} from '../common/dto';
import { flightTimeChangedText } from './flight-change-notification';
import { isOpenFlight } from './flight-status.job';
import {
  localToUtc,
  utcOffset,
  utcToLocal,
  utcToLocalDate,
} from './flight-time';
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
  // GEN-06: the UTC offset of each airport at that time, e.g. "+02:00".
  departureUtcOffset: string;
  arrivalUtcOffset: string;
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

// What POST /api/flights/:id/cancel returns (FLT-06).
export interface CancelledFlightResponse {
  flight: FlightResponse;
  // Confirmed bookings that were cancelled with a 100% refund (PAY-03).
  cancelledBookings: number;
  // Unpaid bookings (pending payment) whose seat hold ended.
  expiredHolds: number;
}

export interface FlightManifestItem {
  id: string;
  reference: string | null;
  passengerNames: string[];
  cabinClass: string;
  seats: number;
  status: BookingStatus;
}

export interface FlightManifestResponse extends PaginatedList<FlightManifestItem> {
  seatsRemaining: { cabinClass: string; seatsRemaining: number }[];
}

const DUPLICATE_FLIGHT =
  'The airline already has this flight number on that departure date.';

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// Area: Airlines & Flight Inventory
// Business logic and database access for: FLT-03, FLT-04, FLT-05, FLT-06, FLT-17, FLT-29, FLT-30, GEN-06
// FLT-30: flights are marked Departed every minute by FlightStatusJob (flight-status.job.ts).
@Injectable()
export class FlightsService {
  private readonly logger = new Logger(FlightsService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Flight.name)
    private readonly flightModel: Model<FlightDocument>,
    @InjectModel(FlightBooking.name)
    private readonly bookingModel: Model<FlightBookingDocument>,
    private readonly notifications: NotificationsService,
    private readonly bookingLifecycle: FlightBookingLifecycleService,
    private readonly airlinesService: AirlinesService,
    private readonly referenceData: ReferenceDataService,
  ) {}

  // FLT-29: view confirmed/cancelled bookings for a managed flight, with remaining inventory.
  async listFlightBookings(
    user: AuthUser,
    flightId: Types.ObjectId,
    query: ListFlightManifestQueryDto,
  ): Promise<FlightManifestResponse> {
    const flight = await this.findManagedFlight(user, flightId);
    const filter = {
      'segments.flightId': flight._id,
      status: query.status
        ? query.status
        : { $in: [BookingStatus.Confirmed, BookingStatus.Cancelled] },
    };
    const page = query.page ?? 1;
    const { skip, limit } = getPaginationOffset(page, DEFAULT_PAGE_SIZE);
    const [bookings, total] = await Promise.all([
      this.bookingModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.bookingModel.countDocuments(filter).exec(),
    ]);

    return {
      ...paginate(
        bookings.map((booking) => this.toManifestItem(booking, flight._id)),
        total,
        page,
        DEFAULT_PAGE_SIZE,
      ),
      seatsRemaining: flight.cabins.map((cabin) => ({
        cabinClass: cabin.cabinClass,
        seatsRemaining: Math.max(0, cabin.total - cabin.booked - cabin.held),
      })),
    };
  }

  private toManifestItem(
    booking: FlightBookingDocument,
    flightId: Types.ObjectId,
  ): FlightManifestItem {
    const segment = booking.segments.find((item) =>
      item.flightId.equals(flightId),
    );
    if (!segment) throw new Error('Booking segment not found.');
    return {
      id: booking._id.toString(),
      reference: booking.reference ?? null,
      passengerNames: booking.passengers.map((passenger) => passenger.fullName),
      cabinClass: segment.cabinClass,
      seats: booking.seats,
      status: booking.status,
    };
  }

  // FLT-29: export one row per passenger from confirmed bookings only.
  async exportPassengers(
    user: AuthUser,
    flightId: Types.ObjectId,
  ): Promise<string> {
    const flight = await this.findManagedFlight(user, flightId);
    const bookings = await this.bookingModel
      .find({
        'segments.flightId': flight._id,
        status: FlightManifestStatus.Confirmed,
      })
      .sort({ createdAt: 1 })
      .exec();
    const rows = ['reference,passengerName,type,cabin,status'];
    for (const booking of bookings) {
      const segment = booking.segments.find((item) =>
        item.flightId.equals(flight._id),
      );
      if (!segment) continue;
      for (const passenger of booking.passengers) {
        rows.push(
          [
            booking.reference ?? '',
            passenger.fullName,
            passenger.type,
            segment.cabinClass,
            booking.status,
          ]
            .map(csvCell)
            .join(','),
        );
      }
    }
    return `${rows.join('\n')}\n`;
  }

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

  // FLT-05: the moderator edits the airports and local times of a Scheduled flight of their
  // airline. Send only the fields to change; the FLT-03 rules still apply. Airports cannot
  // change once the flight has any booking.
  // FLT-05: a time change is copied to the bookings' segments in the same transaction, then the
  // passengers with Confirmed bookings get an in-app notification (GEN-01). Fares and seat counts
  // are edited per cabin (updateCabin).
  async update(
    user: AuthUser,
    flightId: Types.ObjectId,
    dto: UpdateFlightDto,
  ): Promise<FlightResponse> {
    if (
      dto.departureAirport === undefined &&
      dto.arrivalAirport === undefined &&
      dto.departureLocal === undefined &&
      dto.arrivalLocal === undefined
    ) {
      throw new BadRequestException(
        'Send at least one field to change (departureAirport, arrivalAirport, departureLocal or arrivalLocal).',
      );
    }

    const flight = await this.findManagedFlight(user, flightId);
    this.assertScheduled(flight);

    const departureAirport = dto.departureAirport ?? flight.departureAirport;
    const arrivalAirport = dto.arrivalAirport ?? flight.arrivalAirport;
    const airportsChange =
      departureAirport !== flight.departureAirport ||
      arrivalAirport !== flight.arrivalAirport;

    // FLT-05: no airport change once the flight has any booking (any status).
    if (airportsChange) {
      const hasBookings = await this.bookingModel.exists({
        'segments.flightId': flight._id,
      });
      if (hasBookings) {
        throw new ConflictException(
          'The airports cannot change because the flight has bookings.',
        );
      }
    }

    // FLT-03 rules again with the new values.
    if (departureAirport === arrivalAirport) {
      throw new BadRequestException(
        'The departure and arrival airports must be different.',
      );
    }
    const from = await this.referenceData.assertAirport(departureAirport);
    const to = await this.referenceData.assertAirport(arrivalAirport);

    // A local time that is not sent keeps the same local clock time at its (maybe new) airport.
    const departureLocal =
      dto.departureLocal ??
      utcToLocal(flight.departureAt, flight.departureTimeZone);
    const arrivalLocal =
      dto.arrivalLocal ?? utcToLocal(flight.arrivalAt, flight.arrivalTimeZone);
    const departureAt = localToUtc(
      departureLocal,
      from.timeZone,
      'departureLocal',
    );
    const arrivalAt = localToUtc(arrivalLocal, to.timeZone, 'arrivalLocal');

    if (departureAt.getTime() <= Date.now()) {
      throw new BadRequestException('The departure must be in the future.');
    }
    if (arrivalAt.getTime() <= departureAt.getTime()) {
      throw new BadRequestException(
        'The arrival must be after the departure (compared in UTC).',
      );
    }

    const departureDate = utcToLocalDate(departureAt, from.timeZone);
    if (departureDate !== flight.departureDate) {
      const duplicate = await this.flightModel.exists({
        _id: { $ne: flight._id },
        airlineId: flight.airlineId,
        flightNumber: flight.flightNumber,
        departureDate,
      });
      if (duplicate) throw new ConflictException(DUPLICATE_FLIGHT);
    }

    const timesChange =
      departureAt.getTime() !== flight.departureAt.getTime() ||
      arrivalAt.getTime() !== flight.arrivalAt.getTime();
    if (!airportsChange && !timesChange) return this.toResponse(flight);

    const before = {
      flightNumber: flight.flightNumber,
      departureAirport: flight.departureAirport,
      arrivalAirport: flight.arrivalAirport,
      departureTimeZone: flight.departureTimeZone,
      arrivalTimeZone: flight.arrivalTimeZone,
      departureAt: flight.departureAt,
      arrivalAt: flight.arrivalAt,
    };

    let updated: FlightDocument | null = null;
    try {
      await this.connection.transaction(async (session) => {
        updated = await this.flightModel
          .findOneAndUpdate(
            {
              _id: flight._id,
              status: FlightStatus.Scheduled,
              // An airport change also needs no seat booked or held at this moment.
              ...(airportsChange
                ? {
                    cabins: {
                      $not: {
                        $elemMatch: {
                          $or: [{ booked: { $gt: 0 } }, { held: { $gt: 0 } }],
                        },
                      },
                    },
                  }
                : {}),
            },
            {
              $set: {
                departureAirport: from.iataCode,
                arrivalAirport: to.iataCode,
                departureTimeZone: from.timeZone,
                arrivalTimeZone: to.timeZone,
                departureAt,
                arrivalAt,
                departureDate,
              },
            },
            { new: true, runValidators: true, session },
          )
          .exec();
        if (!updated) {
          throw new ConflictException(
            'The flight is not scheduled, or the airports cannot change because the flight has bookings.',
          );
        }

        // FLT-05: the bookings keep a copy of the times (e-ticket, before-departure check,
        // refund tier), so update it together with the flight.
        if (timesChange) {
          await this.bookingModel.updateMany(
            { 'segments.flightId': flight._id },
            {
              $set: {
                'segments.$[s].departureAt': departureAt,
                'segments.$[s].arrivalAt': arrivalAt,
              },
            },
            { arrayFilters: [{ 's.flightId': flight._id }], session },
          );
        }
      });
    } catch (err) {
      if (isDuplicateKeyError(err))
        throw new ConflictException(DUPLICATE_FLIGHT);
      throw err;
    }

    const saved = updated as unknown as FlightDocument;
    if (timesChange) {
      await this.notifyTimeChange(saved, before);
    }
    return this.toResponse(saved);
  }

  // GEN-01, FLT-05: exactly one in-app notification per affected user: the users with a
  // Confirmed booking on this flight, with all their booking references in one message. Runs
  // after the transaction; a failed notification is logged and never undoes the change.
  private async notifyTimeChange(
    flight: FlightDocument,
    before: Parameters<typeof flightTimeChangedText>[1],
  ): Promise<void> {
    const bookings = await this.bookingModel
      .find({
        'segments.flightId': flight._id,
        status: BookingStatus.Confirmed,
      })
      .select('userId reference')
      .lean()
      .exec();
    // FLT-05: group the bookings by user, so a user with two bookings gets one notification.
    const referencesByUser = new Map<string, (string | undefined)[]>();
    for (const booking of bookings) {
      const userId = booking.userId.toString();
      const refs = referencesByUser.get(userId) ?? [];
      refs.push(booking.reference);
      referencesByUser.set(userId, refs);
    }

    for (const [userId, references] of referencesByUser) {
      try {
        const { title, message } = flightTimeChangedText(
          references,
          before,
          flight,
        );
        await this.notifications.notify(userId, title, message);
      } catch (err) {
        this.logger.error(
          `Could not notify user ${userId} of the time change of flight ${flight._id.toString()}: ${String(err)}`,
        );
      }
    }
  }

  // FLT-06: the moderator cancels a Scheduled flight of their airline (the frontend asks
  // for confirmation first, GEN-03). As agreed with Area 1 (flight.schema.ts), in ONE transaction:
  //   - the flight becomes Cancelled (only if still Scheduled), which also stops new seat holds
  //     and hides it from search (FLT-30, openFlightFilter);
  //   - FlightBookingLifecycleService.cancelBookingsForFlight(): every booking with a segment on
  //     this flight (round trips as a whole) changes: confirmed -> cancelled with a 100% refund
  //     owed, pending_payment -> expired, and their seats are released.
  // After the commit, finishFlightCancellation() creates the refunds through Stripe (PAY-03) and
  // sends the in-app notifications (GEN-01).
  async cancel(
    user: AuthUser,
    flightId: Types.ObjectId,
  ): Promise<CancelledFlightResponse> {
    const flight = await this.findManagedFlight(user, flightId);
    if (!isOpenFlight(flight)) {
      throw new ConflictException(
        'The flight is not scheduled (already cancelled or departed).',
      );
    }

    let cancelled: FlightDocument | null = null;
    let result: FlightCancellationResult | null = null;
    await this.connection.transaction(async (session) => {
      cancelled = await this.flightModel
        .findOneAndUpdate(
          { _id: flight._id, status: FlightStatus.Scheduled },
          {
            $set: { status: FlightStatus.Cancelled, cancelledAt: new Date() },
          },
          { new: true, session },
        )
        .exec();
      if (!cancelled) {
        throw new ConflictException(
          'The flight is not scheduled (already cancelled or departed).',
        );
      }
      result = await this.bookingLifecycle.cancelBookingsForFlight(
        flight._id.toString(),
        session,
      );
    });

    const done = result as unknown as FlightCancellationResult;
    // Never throws: a refund that fails here is retried by Area 1's owed-refunds job.
    await this.bookingLifecycle.finishFlightCancellation(done);

    return {
      flight: this.toResponse(cancelled as unknown as FlightDocument),
      cancelledBookings: done.cancelledBookingIds.length,
      expiredHolds: done.expiredBookingIds.length,
    };
  }

  // FLT-04: the moderator adds a cabin class to a Scheduled flight of their airline. Each class
  // from the fixed set is used at most once per flight; the seat counters start at 0.
  async addCabin(
    user: AuthUser,
    flightId: Types.ObjectId,
    dto: CreateCabinDto,
  ): Promise<FlightResponse> {
    const flight = await this.findManagedFlight(user, flightId);
    this.assertScheduled(flight);
    if (flight.cabins.some((c) => c.cabinClass === dto.cabinClass)) {
      throw new ConflictException(
        `The flight already has the ${dto.cabinClass} cabin class.`,
      );
    }

    // One atomic update: two requests at the same moment cannot add the same class twice, and
    // the flight cannot be cancelled in between.
    const updated = await this.flightModel
      .findOneAndUpdate(
        {
          _id: flight._id,
          status: FlightStatus.Scheduled,
          'cabins.cabinClass': { $ne: dto.cabinClass },
        },
        {
          $push: {
            cabins: {
              cabinClass: dto.cabinClass,
              total: dto.seats,
              booked: 0,
              held: 0,
              price: dto.price,
              freeBags: dto.freeBags,
              maxBagWeightKg: dto.maxBagWeightKg,
            },
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updated) {
      throw new ConflictException(
        `The flight already has the ${dto.cabinClass} cabin class, or the flight is not scheduled.`,
      );
    }
    return this.toResponse(updated);
  }

  // FLT-04, FLT-05: the moderator edits a cabin's seat count, price and baggage allowance on a
  // Scheduled flight. The seat count cannot go below the seats already booked or held. A new
  // price only applies to new bookings; existing bookings keep their agreed price (FLT-05).
  async updateCabin(
    user: AuthUser,
    flightId: Types.ObjectId,
    cabinId: Types.ObjectId,
    dto: UpdateCabinDto,
  ): Promise<FlightResponse> {
    if (
      dto.seats === undefined &&
      dto.price === undefined &&
      dto.freeBags === undefined &&
      dto.maxBagWeightKg === undefined
    ) {
      throw new BadRequestException(
        'Send at least one field to change (seats, price, freeBags or maxBagWeightKg).',
      );
    }

    let flight = await this.findManagedFlight(user, flightId);

    // Seat holds (Area 1) change booked/held at any moment, so the update only applies if the
    // counters are still the ones we checked; otherwise read again and retry.
    for (let attempt = 0; attempt < 3; attempt++) {
      this.assertScheduled(flight);
      const cabin = flight.cabins.find((c) => c._id.equals(cabinId));
      if (!cabin) throw new NotFoundException('Flight or cabin not found.');

      const used = cabin.booked + cabin.held;
      if (dto.seats !== undefined && dto.seats < used) {
        throw new BadRequestException(
          `The seat count cannot be lower than the ${used} seats already booked or held.`,
        );
      }

      const changes: Record<string, number> = {};
      if (dto.seats !== undefined) changes['cabins.$.total'] = dto.seats;
      if (dto.price !== undefined) changes['cabins.$.price'] = dto.price;
      if (dto.freeBags !== undefined)
        changes['cabins.$.freeBags'] = dto.freeBags;
      if (dto.maxBagWeightKg !== undefined) {
        changes['cabins.$.maxBagWeightKg'] = dto.maxBagWeightKg;
      }

      const updated = await this.flightModel
        .findOneAndUpdate(
          {
            _id: flight._id,
            status: FlightStatus.Scheduled,
            cabins: {
              $elemMatch: {
                _id: cabin._id,
                booked: cabin.booked,
                held: cabin.held,
              },
            },
          },
          { $set: changes },
          { new: true, runValidators: true },
        )
        .exec();
      if (updated) return this.toResponse(updated);

      flight = await this.findManagedFlight(user, flightId);
    }
    throw new ConflictException(
      'The cabin is being booked right now. Please try again.',
    );
  }

  // The flight that this moderator may change (FLT-04, FLT-05, FLT-06):
  //   404 if the flight does not exist, 403 if it belongs to another airline or the user is not
  //   an airline moderator, 403 if the airline was deactivated (ACC-15).
  async findManagedFlight(
    user: AuthUser,
    flightId: Types.ObjectId | string,
  ): Promise<FlightDocument> {
    if (!Types.ObjectId.isValid(flightId)) {
      throw new NotFoundException('Flight not found.');
    }
    const flight = await this.flightModel.findById(flightId).exec();
    if (!flight) throw new NotFoundException('Flight not found.');

    if (
      user.role !== Role.AirlineModerator ||
      !user.airlineId ||
      user.airlineId !== flight.airlineId.toString()
    ) {
      throw new ForbiddenException(
        "Not the moderator of this flight's airline.",
      );
    }
    // 403 if the airline was deactivated (ACC-15).
    await this.airlinesService.findManagedAirline(user, flight.airlineId);
    return flight;
  }

  // FLT-30: only Scheduled flights that have not departed can be changed (409 otherwise).
  private assertScheduled(flight: FlightDocument): void {
    if (!isOpenFlight(flight)) {
      throw new ConflictException('The flight is not scheduled.');
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
      departureUtcOffset: utcOffset(
        flight.departureAt,
        flight.departureTimeZone,
      ),
      arrivalUtcOffset: utcOffset(flight.arrivalAt, flight.arrivalTimeZone),
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
