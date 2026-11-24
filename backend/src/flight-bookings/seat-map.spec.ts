import { Types } from 'mongoose';
import { BookingStatus, CabinClass, PassengerType } from '../common/enums';
import { FlightBookingsController } from './flight-bookings.controller';
import { FlightSeatSelectionService } from './flight-seat-selection.service';
import type { FlightBookingDocument } from './schemas/flight-booking.schema';

// FLT-28 (bonus) unit tests: the seat map of a booking (GET /api/flight-bookings/{id}/seats, team
// leader decision 24 Nov - seat map route). The layout comes from the existing rule (seatLayout:
// 6 per row in economy / premium economy, 4 in business / first, last row partly filled); a seat
// is taken while it belongs to another Confirmed booking still on that flight and cabin (the same
// rule as isStillHeld). The database collections are faked.

const oid = (n: number) =>
  new Types.ObjectId(`665f1c2a9b1e8a00123456${String(n).padStart(2, '0')}`);
const BOOKING = oid(1);
const OTHER = oid(2);
const STALE = oid(3);
const OUT_FLIGHT = oid(10);
const RET_FLIGHT = oid(11);

type Row = Record<string, unknown>;

function matches(doc: Row, filter: Row): boolean {
  return Object.entries(filter).every(([key, want]) => {
    const have = doc[key];
    if (want && typeof want === 'object' && '$in' in (want as Row)) {
      return (want as { $in: unknown[] }).$in.some(
        (v) => String(v) === String(have),
      );
    }
    return String(have) === String(want);
  });
}

function fakeConnection(data: Record<string, Row[]>) {
  return {
    collection: (name: string) => ({
      find: (filter: Row) => {
        const rows = (data[name] ?? []).filter((d) => matches(d, filter));
        const cursor = {
          sort: () => cursor,
          toArray: () => Promise.resolve(rows),
        };
        return cursor;
      },
      findOne: (filter: Row) =>
        Promise.resolve(
          (data[name] ?? []).find((d) => matches(d, filter)) ?? null,
        ),
    }),
  };
}

const seatRow = (
  bookingId: Types.ObjectId,
  segmentIndex: number,
  passengerIndex: number,
  flightId: Types.ObjectId,
  seatNumber: string,
) => ({
  bookingId,
  segmentIndex,
  passengerIndex,
  flightId,
  cabinClass: CabinClass.Business,
  seatNumber,
});

const booking = {
  _id: BOOKING,
  status: BookingStatus.Confirmed,
  segments: [
    {
      flightId: OUT_FLIGHT,
      flightNumber: 'NA101',
      cabinClass: CabinClass.Business,
    },
    {
      flightId: RET_FLIGHT,
      flightNumber: 'NA102',
      cabinClass: CabinClass.Business,
    },
  ],
  passengers: [
    { fullName: 'Mona Adel', type: PassengerType.Adult },
    { fullName: 'Laila Adel', type: PassengerType.Infant },
  ],
} as unknown as FlightBookingDocument;

const data = {
  flights: [
    {
      _id: OUT_FLIGHT,
      cabins: [{ cabinClass: CabinClass.Business, total: 6 }],
    },
    {
      _id: RET_FLIGHT,
      cabins: [{ cabinClass: CabinClass.Business, total: 4 }],
    },
  ],
  flight_seat_assignments: [
    seatRow(BOOKING, 0, 0, OUT_FLIGHT, '1B'),
    seatRow(OTHER, 0, 0, OUT_FLIGHT, '2A'),
    seatRow(STALE, 0, 0, OUT_FLIGHT, '1C'),
  ],
  flightbookings: [
    {
      _id: OTHER,
      status: BookingStatus.Confirmed,
      segments: [{ flightId: OUT_FLIGHT, cabinClass: CabinClass.Business }],
    },
    {
      _id: STALE,
      status: BookingStatus.Cancelled,
      segments: [{ flightId: OUT_FLIGHT, cabinClass: CabinClass.Business }],
    },
  ],
};

describe('seatMap (FLT-28)', () => {
  it("lists every seat of each flight of the booking: this booking's own, taken by another Confirmed booking, or available", async () => {
    const service = new FlightSeatSelectionService(
      fakeConnection(data) as never,
    );
    expect(await service.seatMap(booking)).toEqual({
      bookingId: BOOKING.toString(),
      segments: [
        {
          segment: 'outbound',
          flightNumber: 'NA101',
          cabinClass: 'business',
          rows: 2,
          letters: 'ABCD',
          seats: [
            { seatNumber: '1A', status: 'available', passengerIndex: null },
            { seatNumber: '1B', status: 'mine', passengerIndex: 0 },
            // a seat of a cancelled booking is free again
            { seatNumber: '1C', status: 'available', passengerIndex: null },
            { seatNumber: '1D', status: 'available', passengerIndex: null },
            { seatNumber: '2A', status: 'taken', passengerIndex: null },
            { seatNumber: '2B', status: 'available', passengerIndex: null },
          ],
        },
        {
          segment: 'return',
          flightNumber: 'NA102',
          cabinClass: 'business',
          rows: 1,
          letters: 'ABCD',
          seats: [
            { seatNumber: '1A', status: 'available', passengerIndex: null },
            { seatNumber: '1B', status: 'available', passengerIndex: null },
            { seatNumber: '1C', status: 'available', passengerIndex: null },
            { seatNumber: '1D', status: 'available', passengerIndex: null },
          ],
        },
      ],
    });
  });

  it('a seat of a booking moved to another flight is free again', async () => {
    const moved = {
      ...data,
      flightbookings: [
        {
          _id: OTHER,
          status: BookingStatus.Confirmed,
          segments: [{ flightId: RET_FLIGHT, cabinClass: CabinClass.Business }],
        },
        data.flightbookings[1],
      ],
    };
    const service = new FlightSeatSelectionService(
      fakeConnection(moved) as never,
    );
    const outbound = (await service.seatMap(booking)).segments[0];
    expect(outbound.seats.find((s) => s.seatNumber === '2A')).toEqual({
      seatNumber: '2A',
      status: 'available',
      passengerIndex: null,
    });
  });
  it("a row of this booking that belongs to another segment index is not this flight's seat", async () => {
    const stale = {
      ...data,
      flight_seat_assignments: [
        ...data.flight_seat_assignments,
        seatRow(BOOKING, 1, 0, OUT_FLIGHT, '2B'),
      ],
    };
    const service = new FlightSeatSelectionService(
      fakeConnection(stale) as never,
    );
    const outbound = (await service.seatMap(booking)).segments[0];
    expect(outbound.seats.find((s) => s.seatNumber === '2B')).toEqual({
      seatNumber: '2B',
      status: 'available',
      passengerIndex: null,
    });
  });
});

describe('GET /api/flight-bookings/:id/seats (FLT-28)', () => {
  it("reads the user's own booking (another user's answers 404 in findOwned) and returns its seat map", async () => {
    const map = { bookingId: BOOKING.toString(), segments: [] };
    const findOwned = jest.fn().mockResolvedValue(booking);
    const seatMap = jest.fn().mockResolvedValue(map);
    const controller = new (
      FlightBookingsController as unknown as new (
        ...a: unknown[]
      ) => FlightBookingsController
    )({ findOwned }, null, null, null, { seatMap }, null);
    await expect(
      controller.seats({ id: 'u1' } as never, BOOKING.toString()),
    ).resolves.toBe(map);
    expect(findOwned).toHaveBeenCalledWith('u1', BOOKING.toString());
    expect(seatMap).toHaveBeenCalledWith(booking);
  });
});
