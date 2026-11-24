import { Types } from 'mongoose';
import { BookingStatus, CabinClass } from '../common/enums';
import { HotelBookingsService } from '../hotel-bookings/hotel-bookings.service';
import { BookingGroup } from '../hotel-bookings/dto/list-hotel-bookings-query.dto';
import { FlightBookingGroup } from './dto/list-flight-bookings-query.dto';
import { FlightBookingsService } from './flight-bookings.service';

// FLT-25, HTL-20 unit tests: the Upcoming group also lists Pending Payment bookings whose hold has
// not expired, with their hold time (team leader decision 24 Nov - pending payment in upcoming).
// ACC-12 (account deactivation) still counts Confirmed bookings only. The model is faked: the
// filter it receives is checked, and the rows it returns are mapped.

const USER_ID = '665f1c2a9b1e8a0012345601';
const NOW = new Date('2027-02-01T10:00:00.000Z');
const HOLD = new Date('2027-02-01T10:08:00.000Z');

function fakeModel(docs: unknown[]) {
  const calls: { find?: unknown; exists?: unknown } = {};
  const chain = {
    sort: () => chain,
    skip: () => chain,
    limit: () => chain,
    exec: () => Promise.resolve(docs),
    then: (resolve: (v: unknown[]) => unknown) =>
      Promise.resolve(docs).then(resolve),
  };
  const model = {
    find: (filter: unknown) => {
      calls.find = filter;
      return chain;
    },
    countDocuments: () => ({ exec: () => Promise.resolve(docs.length) }),
    exists: (filter: unknown) => {
      calls.exists = filter;
      return Promise.resolve(null);
    },
  };
  return { model, calls };
}

const flightService = (model: unknown) =>
  new (
    FlightBookingsService as unknown as new (
      ...a: unknown[]
    ) => FlightBookingsService
  )(model);
const hotelService = (model: unknown) =>
  new (
    HotelBookingsService as unknown as new (
      ...a: unknown[]
    ) => HotelBookingsService
  )(model);

const flightDoc = (status: BookingStatus, holdExpiresAt: Date | null) => ({
  _id: new Types.ObjectId('665f1c2a9b1e8a0012345611'),
  reference: null,
  status,
  holdExpiresAt,
  segments: [
    {
      flightNumber: 'NA101',
      departureAirport: { code: 'CAI', timeZone: 'Africa/Cairo' },
      arrivalAirport: { code: 'DXB', timeZone: 'Asia/Dubai' },
      departureAt: new Date('2027-03-01T06:00:00.000Z'),
      cabinClass: CabinClass.Economy,
    },
  ],
  passengers: [{}],
});

const hotelDoc = (status: BookingStatus, holdExpiresAt: Date | null) => ({
  _id: new Types.ObjectId('665f1c2a9b1e8a0012345621'),
  reference: null,
  status,
  holdExpiresAt,
  hotelId: new Types.ObjectId('665f1c2a9b1e8a0012345631'),
  hotelName: 'Nile View Hotel',
  rooms: [
    {
      roomId: new Types.ObjectId('665f1c2a9b1e8a0012345641'),
      roomNumber: '101',
      type: 'Double',
      adults: 2,
      childrenAges: [],
    },
  ],
  checkIn: new Date('2027-03-01T00:00:00.000Z'),
  checkOut: new Date('2027-03-04T00:00:00.000Z'),
  totalAmount: 36000,
  currency: 'USD',
});

describe('Upcoming flight bookings (FLT-25)', () => {
  it('lists Confirmed bookings with a flight ahead and Pending Payment bookings whose hold has not expired', async () => {
    const { model, calls } = fakeModel([]);
    await flightService(model).listOwn(
      USER_ID,
      { group: FlightBookingGroup.Upcoming, page: 1 },
      NOW,
    );
    expect(calls.find).toEqual({
      userId: USER_ID,
      $or: [
        {
          status: BookingStatus.Confirmed,
          $expr: { $gt: [{ $max: '$segments.departureAt' }, NOW] },
        },
        { status: BookingStatus.PendingPayment, holdExpiresAt: { $gt: NOW } },
      ],
    });
  });

  it('rows carry the hold time of a Pending Payment booking, null otherwise', async () => {
    const { model } = fakeModel([
      flightDoc(BookingStatus.PendingPayment, HOLD),
      flightDoc(BookingStatus.Confirmed, HOLD),
    ]);
    const page = await flightService(model).listOwn(
      USER_ID,
      { group: FlightBookingGroup.Upcoming, page: 1 },
      NOW,
    );
    expect(page.items.map((i) => i.holdExpiresAt)).toEqual([HOLD, null]);
  });

  it('ACC-12 still counts Confirmed bookings only (a held booking does not block deactivation)', async () => {
    const { model, calls } = fakeModel([]);
    await flightService(model).hasUpcomingBookings(USER_ID, NOW);
    expect(calls.exists).toEqual({
      userId: USER_ID,
      status: BookingStatus.Confirmed,
      $expr: { $gt: [{ $max: '$segments.departureAt' }, NOW] },
    });
  });
});

describe('Upcoming hotel reservations (HTL-20)', () => {
  it('lists Confirmed reservations before check-in and Pending Payment ones whose hold has not expired', async () => {
    const { model, calls } = fakeModel([]);
    await hotelService(model).listOwned(
      USER_ID,
      { group: BookingGroup.Upcoming, page: 1 },
      NOW,
    );
    expect(calls.find).toEqual({
      userId: USER_ID,
      $or: [
        {
          status: BookingStatus.Confirmed,
          checkIn: { $gt: new Date('2027-02-01T00:00:00.000Z') },
        },
        { status: BookingStatus.PendingPayment, holdExpiresAt: { $gt: NOW } },
      ],
    });
  });

  it('rows carry the hold time of a Pending Payment reservation, null otherwise', async () => {
    const { model } = fakeModel([
      hotelDoc(BookingStatus.PendingPayment, HOLD),
      hotelDoc(BookingStatus.Cancelled, HOLD),
    ]);
    const page = await hotelService(model).listOwned(
      USER_ID,
      { group: BookingGroup.Upcoming, page: 1 },
      NOW,
    );
    expect(page.items.map((i) => i.holdExpiresAt)).toEqual([HOLD, null]);
  });

  it('ACC-12 still counts Confirmed reservations only', async () => {
    const { model, calls } = fakeModel([]);
    await hotelService(model).hasUpcomingBookings(USER_ID, NOW);
    expect(calls.exists).toEqual({
      userId: USER_ID,
      status: BookingStatus.Confirmed,
      checkIn: { $gt: new Date('2027-02-01T00:00:00.000Z') },
    });
  });
});
