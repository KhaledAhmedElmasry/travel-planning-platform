// Building blocks the system tests share. Everything is created through the public API, the same
// way a client would do it.
import { Account, Client, TestApp, day, unique } from './harness';

export interface AirlineSetup {
  airlineId: string;
  code: string;
  moderator: Account;
}

/** An airline with its moderator. */
export async function airlineWithModerator(t: TestApp): Promise<AirlineSetup> {
  const airline = await t.airline();
  const moderator = await t.moderator('airline_moderator', airline.id);
  return { airlineId: airline.id, code: airline.code, moderator };
}

let flightCounter = 100;

export interface FlightOptions {
  from?: string;
  to?: string;
  /** Days from today of the local departure date. */
  inDays?: number;
  departureTime?: string;
  arrivalTime?: string;
  /** Days after the departure date of the local arrival date. */
  arrivalDayOffset?: number;
  flightNumber?: string;
}

/**
 * A flight DXB (UTC+4, no daylight saving) -> RUH (UTC+3, no daylight saving) unless told otherwise:
 * departs 10:00 local = 06:00 UTC, arrives 11:00 local = 08:00 UTC, 120 minutes.
 */
export async function createFlight(
  airline: AirlineSetup,
  options: FlightOptions = {},
) {
  flightCounter += 1;
  const inDays = options.inDays ?? 40;
  const body = {
    flightNumber: options.flightNumber ?? `${airline.code}${flightCounter}`,
    departureAirport: options.from ?? 'DXB',
    arrivalAirport: options.to ?? 'RUH',
    departureLocal: `${day(inDays)}T${options.departureTime ?? '10:00'}`,
    arrivalLocal: `${day(inDays + (options.arrivalDayOffset ?? 0))}T${options.arrivalTime ?? '11:00'}`,
  };
  const res = await airline.moderator.client.post('/api/flights', body);
  if (res.status !== 201) throw new Error(`Flight not created: ${res.text}`);
  return res.body as { id: string; flightNumber: string; [key: string]: any };
}

export interface CabinOptions {
  cabinClass?: string;
  seats?: number;
  price?: number;
  freeBags?: number;
  maxBagWeightKg?: number;
}

export async function addCabin(
  airline: AirlineSetup,
  flightId: string,
  options: CabinOptions = {},
) {
  const res = await airline.moderator.client.post(
    `/api/flights/${flightId}/cabins`,
    {
      cabinClass: options.cabinClass ?? 'economy',
      seats: options.seats ?? 10,
      price: options.price ?? 20000,
      freeBags: options.freeBags ?? 1,
      maxBagWeightKg: options.maxBagWeightKg ?? 23,
    },
  );
  if (res.status !== 201) throw new Error(`Cabin not added: ${res.text}`);
  return res.body as { id: string; cabins: any[] };
}

/** A flight with one economy cabin, ready to be booked. */
export async function bookableFlight(
  airline: AirlineSetup,
  flight: FlightOptions = {},
  cabin: CabinOptions = {},
) {
  const created = await createFlight(airline, flight);
  await addCabin(airline, created.id, cabin);
  return created;
}

export const adult = (
  name = 'Adult One',
  extraBags?: { weightKg: number }[],
) => ({
  type: 'adult',
  fullName: name,
  dateOfBirth: '1990-05-20',
  passportNumber: unique('P').toUpperCase().slice(0, 12),
  ...(extraBags ? { extraBags } : {}),
});

/** The seat counters of a cabin, read from the public flight details (FLT-17). */
export async function seatsRemaining(
  t: TestApp,
  flightId: string,
  cabinClass = 'economy',
): Promise<number> {
  const res = await t.guest().get(`/api/flights/${flightId}`);
  const cabin = (res.body.cabins as any[]).find(
    (c) => c.cabinClass === cabinClass,
  );
  return cabin.seatsRemaining as number;
}

export type BookingKind = 'flight' | 'hotel';
const bookingPath = (kind: BookingKind) =>
  kind === 'flight' ? '/api/flight-bookings' : '/api/hotel-bookings';

export function bookingDetails(client: Client, kind: BookingKind, id: string) {
  return client.get(`${bookingPath(kind)}/${id}`);
}

/** Accepts the provider policies (PAY-02). */
export function acceptPolicies(client: Client, kind: BookingKind, id: string) {
  return client.post(`/api/bookings/${kind}/${id}/accept-policies`, {
    accepted: true,
  });
}

/**
 * Accepts the policies, pays with a Stripe test payment method and waits until the real Stripe
 * webhook has confirmed the booking (PAY-01, FLT-23, HTL-17).
 */
export async function payAndConfirm(
  t: TestApp,
  client: Client,
  kind: BookingKind,
  bookingId: string,
  paymentMethodId = 'pm_card_visa',
) {
  const accepted = await acceptPolicies(client, kind, bookingId);
  if (accepted.status !== 200) {
    throw new Error(`Policies not accepted: ${accepted.text}`);
  }
  const payment = await client.post('/api/payments', {
    bookingType: kind,
    bookingId,
    paymentMethodId,
  });
  if (payment.status !== 201) {
    throw new Error(`Payment not created: ${payment.text}`);
  }
  const booking = await t.eventually(async () => {
    const res = await bookingDetails(client, kind, bookingId);
    return res.body.status === 'confirmed' ? res.body : undefined;
  }, `the Stripe webhook to confirm ${kind} booking ${bookingId}`);
  return { payment: payment.body, booking };
}

/** The in-app notifications of an account, newest first. */
export async function notifications(client: Client) {
  const res = await client.get('/api/notifications');
  return res.body.items as { title: string; message: string; read: boolean }[];
}

export interface HotelSetup {
  hotelId: string;
  name: string;
  moderator: Account;
}

export async function hotelWithModerator(
  t: TestApp,
  overrides: Record<string, string> = {},
): Promise<HotelSetup> {
  const hotel = await t.hotel(overrides);
  const moderator = await t.moderator('hotel_moderator', hotel.id);
  return { hotelId: hotel.id, name: hotel.name, moderator };
}

export interface RoomOptions {
  roomNumber?: string;
  type?: string;
  beds?: number;
  maxOccupancy?: number;
  pricePerNight?: number;
  /** Bookable range in days from today (default: today+1 .. today+120). */
  availableFrom?: number;
  availableTo?: number;
  noAvailability?: boolean;
}

/** A room with one bookable date range. */
export async function addRoom(hotel: HotelSetup, options: RoomOptions = {}) {
  const created = await hotel.moderator.client.post(
    `/api/hotels/${hotel.hotelId}/rooms`,
    {
      roomNumber: options.roomNumber ?? unique('R').slice(-8),
      type: options.type ?? 'Double',
      beds: options.beds ?? 2,
      maxOccupancy: options.maxOccupancy ?? 2,
      pricePerNight: options.pricePerNight ?? 10000,
    },
  );
  if (created.status !== 201) {
    throw new Error(`Room not created: ${created.text}`);
  }
  if (!options.noAvailability) {
    const range = await hotel.moderator.client.post(
      `/api/hotels/${hotel.hotelId}/rooms/${created.body.id}/availability`,
      {
        from: day(options.availableFrom ?? 1),
        to: day(options.availableTo ?? 120),
      },
    );
    if (range.status !== 201) {
      throw new Error(`Availability not added: ${range.text}`);
    }
  }
  return created.body as { id: string; roomNumber: string };
}
