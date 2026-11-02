// TODO(AREA-1): PLACEHOLDER until Area 1 seat-reservation provider is merged. Replace provider and delete this file.
// Requirement: FLT-12.
import { Injectable } from '@nestjs/common';

export interface CabinSeatReservations {
  booked: number;
  held: number;
}

export interface SeatReservationProvider {
  getReservedSeats(
    flightIds: string[],
  ): Promise<Map<string, Record<string, CabinSeatReservations>>>;
}

export const SEAT_RESERVATION_PROVIDER = Symbol('SEAT_RESERVATION_PROVIDER');

@Injectable()
export class PlaceholderSeatReservationProvider implements SeatReservationProvider {
  // Real booked seats are Confirmed bookings; held seats are non-expired Pending Payment holds.
  // This placeholder reports zeroes until Area 1's batched provider is merged.
  getReservedSeats(
    flightIds: string[],
  ): Promise<Map<string, Record<string, CabinSeatReservations>>> {
    return Promise.resolve(
      new Map(
        flightIds.map((flightId) => [
          flightId,
          {
            Economy: { booked: 0, held: 0 },
            'Premium Economy': { booked: 0, held: 0 },
            Business: { booked: 0, held: 0 },
            First: { booked: 0, held: 0 },
          },
        ]),
      ),
    );
  }
}
