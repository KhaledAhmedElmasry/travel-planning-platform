import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ClientSession, Connection, Types } from 'mongoose';
import { CabinClass } from '../common/enums';

// Area: Payments, Holds & Booking Engine
// Requirements: FLT-22, FLT-23, FLT-26
// The seat counters of a flight's cabin: total, booked and held. Every change is ONE atomic
// update on the flight document, so concurrent requests can never book more seats than exist:
// MongoDB applies the condition and the change together, and only one request can take the
// last seat (FLT-22).
//
// The flights collection belongs to Area 5 (FLT-03, FLT-04). The field names used here are the
// agreed ones written in flights/schemas/flight.schema.ts. When Area 5's Flight model exists this
// can use it instead of the raw collection; the queries stay the same.
const FLIGHTS_COLLECTION = 'flights';

@Injectable()
export class SeatInventoryService {
  private readonly logger = new Logger(SeatInventoryService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  // FLT-22: held += seats, only if the flight is still scheduled and has not departed, and the
  // cabin has at least `seats` free seats (total - booked - held). Returns false otherwise.
  async hold(
    flightId: string,
    cabinClass: CabinClass,
    seats: number,
    session?: ClientSession,
  ): Promise<boolean> {
    const result = await this.flights().updateOne(
      {
        _id: new Types.ObjectId(flightId),
        status: 'scheduled',
        departureAt: { $gt: new Date() },
        $expr: { $gte: [freeSeats(cabinClass), seats] },
      },
      { $inc: { 'cabins.$[c].held': seats } },
      { arrayFilters: [{ 'c.cabinClass': cabinClass }], session },
    );
    return result.modifiedCount === 1;
  }

  // Hold expired (FLT-22, GEN-11): held -= seats.
  releaseHeld(
    flightId: string,
    cabinClass: CabinClass,
    seats: number,
    session?: ClientSession,
  ): Promise<boolean> {
    return this.move(flightId, cabinClass, seats, { held: -seats }, session);
  }

  // Payment confirmed (FLT-23): held -= seats, booked += seats.
  convertHeldToBooked(
    flightId: string,
    cabinClass: CabinClass,
    seats: number,
    session?: ClientSession,
  ): Promise<boolean> {
    return this.move(
      flightId,
      cabinClass,
      seats,
      { held: -seats, booked: seats },
      session,
    );
  }

  // Booking cancelled (FLT-26): booked -= seats, the seats return to inventory.
  releaseBooked(
    flightId: string,
    cabinClass: CabinClass,
    seats: number,
    session?: ClientSession,
  ): Promise<boolean> {
    return this.move(flightId, cabinClass, seats, { booked: -seats }, session);
  }

  // Applies the changes only if no counter would go below 0. Returning false means the counters
  // do not match the booking (a bug), so it is logged.
  private async move(
    flightId: string,
    cabinClass: CabinClass,
    seats: number,
    change: { held?: number; booked?: number },
    session?: ClientSession,
  ): Promise<boolean> {
    const inc: Record<string, number> = {};
    const guards: Record<string, unknown>[] = [];
    for (const [counter, delta] of Object.entries(change)) {
      inc[`cabins.$[c].${counter}`] = delta;
      if (delta < 0) {
        guards.push({ $gte: [cabinCounter(cabinClass, counter), seats] });
      }
    }
    const result = await this.flights().updateOne(
      {
        _id: new Types.ObjectId(flightId),
        ...(guards.length > 0 && { $expr: { $and: guards } }),
      },
      { $inc: inc },
      { arrayFilters: [{ 'c.cabinClass': cabinClass }], session },
    );
    if (result.modifiedCount !== 1) {
      this.logger.error(
        `Seat counters of flight ${flightId} (${cabinClass}) not changed by ${JSON.stringify(change)}.`,
      );
      return false;
    }
    return true;
  }

  private flights() {
    return this.connection.collection(FLIGHTS_COLLECTION);
  }
}

// The cabin with this class inside the flight document (aggregation expression).
function cabin(cabinClass: CabinClass) {
  return {
    $arrayElemAt: [
      {
        $filter: {
          input: '$cabins',
          cond: { $eq: ['$$this.cabinClass', cabinClass] },
        },
      },
      0,
    ],
  };
}

function cabinCounter(cabinClass: CabinClass, counter: string) {
  return { $getField: { field: counter, input: cabin(cabinClass) } };
}

// total - booked - held of the cabin (null if the cabin does not exist, so the check fails).
function freeSeats(cabinClass: CabinClass) {
  return {
    $subtract: [
      cabinCounter(cabinClass, 'total'),
      {
        $add: [
          cabinCounter(cabinClass, 'booked'),
          cabinCounter(cabinClass, 'held'),
        ],
      },
    ],
  };
}
