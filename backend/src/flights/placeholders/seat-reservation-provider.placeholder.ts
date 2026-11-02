// TODO(AREA-1): PLACEHOLDER until Area 1's seat reservation provider is merged. Replace PlaceholderSeatReservationProvider with that provider and delete this file.
// Requirements: FLT-11, FLT-22, FLT-23, GEN-13.
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

export const SEAT_RESERVATION_PROVIDER = Symbol('SeatReservationProvider');

@Injectable()
export class PlaceholderSeatReservationProvider implements SeatReservationProvider {
  getReservedSeats(
    flightIds: string[],
  ): Promise<Map<string, Record<string, CabinSeatReservations>>> {
    // Real booked seats are Confirmed bookings; held seats are non-expired Pending Payment holds.
    const reservations = new Map<
      string,
      Record<string, CabinSeatReservations>
    >();
    for (const flightId of flightIds) {
      reservations.set(flightId, {
        Economy: { booked: 0, held: 0 },
        'Premium Economy': { booked: 0, held: 0 },
        Business: { booked: 0, held: 0 },
        First: { booked: 0, held: 0 },
      });
    }
    return Promise.resolve(reservations);
  }
}
