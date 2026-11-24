import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { BookingStatus, CabinClass, PassengerType } from '../common/enums';
import { SelectSeatDto } from './dto/select-seat.dto';
import { FlightBookingDocument } from './schemas/flight-booking.schema';

// Area: Payments, Holds & Booking Engine
// FLT-28 (bonus): seat selection for the passengers of a Confirmed flight booking.
//
// There is no stored seat map. A cabin's seat map is derived from its seat count (FLT-04):
// economy and premium economy have 6 seats per row (A-F), business and first 4 (A-D); rows are
// numbered from 1 in every cabin, the last row may be partly filled. So a flight with 20
// economy seats has rows 1-4: 1A-1F, 2A-2F, 3A-3F, 4A-4B.
//
// The chosen seats live in their own collection with two unique indexes:
//   (flightId, cabinClass, seatNumber): a seat belongs to one passenger, even when two users pick
//                                       it at the same moment;
//   (bookingId, segmentIndex, passengerIndex): a passenger has one seat per flight; choosing again
//                                       moves the passenger.
// A seat held by a booking that is no longer Confirmed (cancelled, flight cancelled, changed) is
// free again: it is taken over when someone else chooses it (see assign()).

export type SeatSegment = 'outbound' | 'return';

export interface SeatAssignmentResponse {
  segment: SeatSegment;
  passengerIndex: number;
  passengerName: string;
  flightNumber: string;
  cabinClass: string;
  seatNumber: string;
}

interface SeatAssignmentDocument {
  _id: Types.ObjectId;
  bookingId: Types.ObjectId;
  segmentIndex: number;
  passengerIndex: number;
  flightId: Types.ObjectId;
  cabinClass: CabinClass;
  seatNumber: string;
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SEATS_PER_ROW: Record<CabinClass, number> = {
  [CabinClass.Economy]: 6,
  [CabinClass.PremiumEconomy]: 6,
  [CabinClass.Business]: 4,
  [CabinClass.First]: 4,
};

const TAKEN = 'The seat is already taken.';

// GET /api/flight-bookings/{id}/seats (FLT-28): every seat of the booking's cabin on each flight.
// mine = chosen by a passenger of this booking (passengerIndex), taken = held by another booking
// (isStillHeld rule), available = free.
export interface SeatMapSeat {
  seatNumber: string;
  status: 'available' | 'taken' | 'mine';
  passengerIndex: number | null;
}

export interface SeatMapSegment {
  segment: SeatSegment;
  flightNumber: string;
  cabinClass: string;
  rows: number;
  letters: string;
  seats: SeatMapSeat[];
}

export interface SeatMapResponse {
  bookingId: string;
  segments: SeatMapSegment[];
}

// The seat labels of a cabin with `total` seats, for example ['1A', '1B', ...].
export function seatLayout(
  cabinClass: CabinClass,
  total: number,
): { rows: number; letters: string; seatsPerRow: number } {
  const seatsPerRow = SEATS_PER_ROW[cabinClass] ?? 6;
  return {
    rows: Math.ceil(total / seatsPerRow),
    letters: 'ABCDEF'.slice(0, seatsPerRow),
    seatsPerRow,
  };
}

// True when the seat exists in a cabin of `total` seats.
export function seatExists(
  cabinClass: CabinClass,
  total: number,
  seatNumber: string,
): boolean {
  const match = /^([1-9]\d{0,2})([A-Z])$/.exec(seatNumber);
  if (!match) return false;
  const { letters, seatsPerRow } = seatLayout(cabinClass, total);
  const row = Number(match[1]);
  const column = letters.indexOf(match[2]);
  return column >= 0 && (row - 1) * seatsPerRow + column < total;
}

@Injectable()
export class FlightSeatSelectionService implements OnModuleInit {
  private readonly logger = new Logger(FlightSeatSelectionService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.seats().createIndex(
        { flightId: 1, cabinClass: 1, seatNumber: 1 },
        { unique: true },
      );
      await this.seats().createIndex(
        { bookingId: 1, segmentIndex: 1, passengerIndex: 1 },
        { unique: true },
      );
    } catch (error) {
      this.logger.error(`Could not create the seat indexes: ${String(error)}`);
    }
  }

  private seats() {
    return this.connection.collection<SeatAssignmentDocument>(
      'flight_seat_assignments',
    );
  }

  // Chooses (or changes) the seat of one passenger on one flight of the booking. `booking` is
  // already known to belong to the user.
  async selectSeat(
    booking: FlightBookingDocument,
    dto: SelectSeatDto,
    now = new Date(),
  ): Promise<SeatAssignmentResponse[]> {
    if (booking.status !== BookingStatus.Confirmed) {
      throw new ConflictException(
        `This booking is ${booking.status}; seats can only be selected for a confirmed booking.`,
      );
    }
    const segmentIndex = dto.segment === 'return' ? 1 : 0;
    const segment = booking.segments[segmentIndex];
    if (!segment) {
      throw new BadRequestException('This booking has no return flight.');
    }
    if (segment.departureAt.getTime() <= now.getTime()) {
      throw new ConflictException('This flight has already departed.');
    }
    const passenger = booking.passengers[dto.passengerIndex];
    if (!passenger) {
      throw new BadRequestException(
        `The booking has ${booking.passengers.length} passenger(s); passengerIndex ${dto.passengerIndex} does not exist.`,
      );
    }
    if (passenger.type === PassengerType.Infant) {
      throw new BadRequestException('Infants have no seat.');
    }

    const flight = await this.connection
      .collection<{
        _id: Types.ObjectId;
        cabins?: { cabinClass: CabinClass; total: number }[];
      }>('flights')
      .findOne({ _id: segment.flightId });
    const cabin = flight?.cabins?.find(
      (item) => item.cabinClass === segment.cabinClass,
    );
    if (!cabin) throw new NotFoundException('Flight not found.');
    if (!seatExists(segment.cabinClass, cabin.total, dto.seatNumber)) {
      const { rows, letters } = seatLayout(segment.cabinClass, cabin.total);
      throw new BadRequestException(
        `Seat ${dto.seatNumber} does not exist in this cabin (rows 1-${rows}, letters ${letters[0]}-${letters[letters.length - 1]}).`,
      );
    }

    await this.assign({
      bookingId: booking._id,
      segmentIndex,
      passengerIndex: dto.passengerIndex,
      flightId: segment.flightId,
      cabinClass: segment.cabinClass,
      seatNumber: dto.seatNumber,
      userId: booking.userId,
    });
    return this.list(booking);
  }

  private async assign(
    seat: Omit<SeatAssignmentDocument, '_id' | 'createdAt' | 'updatedAt'>,
    retry = true,
  ): Promise<void> {
    const now = new Date();
    try {
      await this.seats().updateOne(
        {
          bookingId: seat.bookingId,
          segmentIndex: seat.segmentIndex,
          passengerIndex: seat.passengerIndex,
        },
        {
          $set: {
            flightId: seat.flightId,
            cabinClass: seat.cabinClass,
            seatNumber: seat.seatNumber,
            userId: seat.userId,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      // Either the seat belongs to another passenger, or two requests for this passenger
      // created the row at the same moment (retry once).
      const holder = await this.seats().findOne({
        flightId: seat.flightId,
        cabinClass: seat.cabinClass,
        seatNumber: seat.seatNumber,
      });
      if (!holder) {
        if (retry) return this.assign(seat, false);
        throw new ConflictException(TAKEN);
      }
      const sameSlot =
        holder.bookingId.equals(seat.bookingId) &&
        holder.segmentIndex === seat.segmentIndex &&
        holder.passengerIndex === seat.passengerIndex;
      if (sameSlot) return;
      // A seat of a booking that is no longer Confirmed, or of a flight the booking was moved
      // off, is free again: it is taken over, once.
      if (retry && !(await this.isStillHeld(holder))) {
        await this.seats().deleteOne({ _id: holder._id });
        return this.assign(seat, false);
      }
      throw new ConflictException(TAKEN);
    }
  }

  private async isStillHeld(seat: SeatAssignmentDocument): Promise<boolean> {
    const booking = await this.connection
      .collection<{
        status: BookingStatus;
        segments?: { flightId: Types.ObjectId; cabinClass: CabinClass }[];
      }>('flightbookings')
      .findOne({ _id: seat.bookingId });
    if (!booking || booking.status !== BookingStatus.Confirmed) return false;
    const segment = booking.segments?.[seat.segmentIndex];
    return (
      !!segment &&
      segment.flightId.equals(seat.flightId) &&
      segment.cabinClass === seat.cabinClass
    );
  }

  // The seats chosen on a booking, in flight and passenger order. Seats of a flight the booking
  // is no longer on are not shown.
  async list(
    booking: FlightBookingDocument,
  ): Promise<SeatAssignmentResponse[]> {
    const rows = await this.seats()
      .find({ bookingId: booking._id })
      .sort({ segmentIndex: 1, passengerIndex: 1 })
      .toArray();
    const result: SeatAssignmentResponse[] = [];
    for (const row of rows) {
      const segment = booking.segments[row.segmentIndex];
      const passenger = booking.passengers[row.passengerIndex];
      if (
        !segment ||
        !passenger ||
        !segment.flightId.equals(row.flightId) ||
        segment.cabinClass !== row.cabinClass
      ) {
        continue;
      }
      result.push({
        segment: row.segmentIndex === 1 ? 'return' : 'outbound',
        passengerIndex: row.passengerIndex,
        passengerName: passenger.fullName,
        flightNumber: segment.flightNumber,
        cabinClass: row.cabinClass,
        seatNumber: row.seatNumber,
      });
    }
    return result;
  }

  // The seat map of every flight of the booking (FLT-28). The layout comes from seatLayout(); a
  // seat of another booking counts as taken only while that booking is Confirmed and still on this
  // flight and cabin (the rule of isStillHeld(), checked for all holders in one query).
  async seatMap(booking: FlightBookingDocument): Promise<SeatMapResponse> {
    const segments: SeatMapSegment[] = [];
    for (const [index, segment] of booking.segments.entries()) {
      const flight = await this.connection
        .collection<{
          _id: Types.ObjectId;
          cabins?: { cabinClass: CabinClass; total: number }[];
        }>('flights')
        .findOne({ _id: segment.flightId });
      const total =
        flight?.cabins?.find((c) => c.cabinClass === segment.cabinClass)
          ?.total ?? 0;
      const { rows, letters, seatsPerRow } = seatLayout(
        segment.cabinClass,
        total,
      );

      const assigned = await this.seats()
        .find({ flightId: segment.flightId, cabinClass: segment.cabinClass })
        .toArray();
      const otherIds = assigned
        .filter((a) => !a.bookingId.equals(booking._id))
        .map((a) => a.bookingId);
      const holders = otherIds.length
        ? await this.connection
            .collection<{
              _id: Types.ObjectId;
              status: BookingStatus;
              segments?: { flightId: Types.ObjectId; cabinClass: CabinClass }[];
            }>('flightbookings')
            .find({ _id: { $in: otherIds } })
            .toArray()
        : [];
      const byId = new Map(holders.map((h) => [h._id.toString(), h]));

      const status = new Map<string, SeatMapSeat>();
      for (const a of assigned) {
        if (a.bookingId.equals(booking._id)) {
          if (a.segmentIndex === index) {
            status.set(a.seatNumber, {
              seatNumber: a.seatNumber,
              status: 'mine',
              passengerIndex: a.passengerIndex,
            });
          }
          continue;
        }
        const holder = byId.get(a.bookingId.toString());
        const held = holder?.segments?.[a.segmentIndex];
        if (
          holder?.status === BookingStatus.Confirmed &&
          held?.flightId.equals(a.flightId) &&
          held.cabinClass === a.cabinClass
        ) {
          status.set(a.seatNumber, {
            seatNumber: a.seatNumber,
            status: 'taken',
            passengerIndex: null,
          });
        }
      }

      const seats: SeatMapSeat[] = [];
      for (let n = 0; n < total; n++) {
        const seatNumber = `${Math.floor(n / seatsPerRow) + 1}${letters[n % seatsPerRow]}`;
        seats.push(
          status.get(seatNumber) ?? {
            seatNumber,
            status: 'available',
            passengerIndex: null,
          },
        );
      }
      segments.push({
        segment: index === 1 ? 'return' : 'outbound',
        flightNumber: segment.flightNumber,
        cabinClass: segment.cabinClass,
        rows,
        letters,
        seats,
      });
    }
    return { bookingId: booking._id.toString(), segments };
  }

  // Used when a segment of a booking is moved to another flight (FLT-27): its seats are freed.
  async clearSegment(
    bookingId: Types.ObjectId,
    segmentIndex: number,
  ): Promise<void> {
    await this.seats().deleteMany({ bookingId, segmentIndex });
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}
