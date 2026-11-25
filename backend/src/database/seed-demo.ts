// Demo data for Milestone 2, run with: npm run seed:demo  (needs DEMO_PASSWORD in backend/.env)
//
// Creates test data so every part of the frontend has something real to show (approved by the team
// leader, 23 Nov 2026). It is NOT a requirement and NOT reference data (that is `npm run seed`):
//   - demo.user@yallaway.local            a registered user
//   - Demo Air (code DA) + demo.airline@yallaway.local, its moderator, baggage policy, cancellation
//     tiers and 6 flights between CAI / DXB / LHR in the next 30 days with all 4 cabin classes
//   - one "Demo Hotel <City>" per seeded city, each with its own moderator
//     (demo.hotel.<cityId>@yallaway.local), policies and 3 rooms bookable for the next 60 days
//   - 3 more travellers (demo.traveler1..3@yallaway.local), 6 itineraries (5 public, 1 private)
//     with days, activities, budgets and transport, 4 published posts + 1 draft with tags, comments,
//     likes and attached itineraries, 2 open reports and 2 favourites (team leader, 25 Nov 2026)
//   - 1 paid flight (DA201) + 1 paid stay (Demo Hotel London) for demo.user, paid with Stripe's test
//     card; the script starts `stripe listen` itself (needs the Stripe CLI + a test STRIPE_SECRET_KEY,
//     else these two are skipped)
// Every account logs in with DEMO_PASSWORD. Moderators set it through the normal first-login password
// change (ACC-13), so they never have to change it again.
//
// Everything is created through the public API of the running application, so all the validation,
// ownership and business rules apply (GEN-13). The database is only READ, to find what already exists:
// running the script again creates nothing twice. Flights are dated from "today", so running it on a
// later day adds that day's 6 flights; old ones simply depart.
import { execFileSync, spawn, type ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { AppModule } from '../app.module';
import { configureApp } from '../app.setup';

export interface SeedDemoOptions {
  baseUrl: string;
  db: Connection;
  adminEmail: string;
  adminPassword: string;
  demoPassword: string;
  /** false: skip the paid bookings (they need the Stripe webhook forwarded to this app). */
  payments?: boolean;
}

export const DEMO_DOMAIN = '@yallaway.local';

// Departure and arrival in each airport's local time (FLT-03); safe with or without summer time.
const FLIGHTS = [
  {
    number: 'DA101',
    from: 'CAI',
    to: 'DXB',
    inDays: 3,
    dep: '10:00',
    arr: '15:30',
    arrDays: 0,
  },
  {
    number: 'DA102',
    from: 'DXB',
    to: 'CAI',
    inDays: 6,
    dep: '09:00',
    arr: '11:30',
    arrDays: 0,
  },
  {
    number: 'DA201',
    from: 'CAI',
    to: 'LHR',
    inDays: 10,
    dep: '09:00',
    arr: '13:00',
    arrDays: 0,
  },
  {
    number: 'DA202',
    from: 'LHR',
    to: 'CAI',
    inDays: 14,
    dep: '14:00',
    arr: '21:00',
    arrDays: 0,
  },
  {
    number: 'DA301',
    from: 'DXB',
    to: 'LHR',
    inDays: 21,
    dep: '08:00',
    arr: '12:00',
    arrDays: 0,
  },
  {
    number: 'DA302',
    from: 'LHR',
    to: 'DXB',
    inDays: 28,
    dep: '20:00',
    arr: '07:00',
    arrDays: 1,
  },
];
// Prices in cents of the platform currency (PAY-04).
const CABINS = [
  {
    cabinClass: 'economy',
    seats: 60,
    price: 15000,
    freeBags: 1,
    maxBagWeightKg: 23,
  },
  {
    cabinClass: 'premium_economy',
    seats: 24,
    price: 30000,
    freeBags: 2,
    maxBagWeightKg: 23,
  },
  {
    cabinClass: 'business',
    seats: 12,
    price: 60000,
    freeBags: 2,
    maxBagWeightKg: 32,
  },
  {
    cabinClass: 'first',
    seats: 4,
    price: 120000,
    freeBags: 3,
    maxBagWeightKg: 32,
  },
];
const ROOMS = [
  {
    roomNumber: '101',
    type: 'Single',
    beds: 1,
    maxOccupancy: 1,
    pricePerNight: 8000,
  },
  {
    roomNumber: '102',
    type: 'Double',
    beds: 2,
    maxOccupancy: 2,
    pricePerNight: 12000,
  },
  {
    roomNumber: '201',
    type: 'Family',
    beds: 3,
    maxOccupancy: 4,
    pricePerNight: 20000,
  },
];
const TIERS = [
  { daysBefore: 14, refundPercentage: 100 },
  { daysBefore: 7, refundPercentage: 50 },
  { daysBefore: 2, refundPercentage: 25 },
];

// Demo travellers, itineraries and posts (team leader, 25 Nov 2026). Only the official cities and
// attractions of the reference data (Mock Data) are used; every text says it is demo content.
const TRAVELLERS = [
  { handle: 'demo.traveler1', name: 'Demo Traveler One' },
  { handle: 'demo.traveler2', name: 'Demo Traveler Two' },
  { handle: 'demo.traveler3', name: 'Demo Traveler Three' },
];
type DemoActivity = {
  name: string;
  description: string;
  time?: string;
  cost?: number;
  currency?: string;
};
type DemoBudget = {
  category: 'food' | 'accommodation' | 'in_city_transport' | 'activities';
  amount: number;
  currency: string;
  description?: string;
};
type DemoItinerary = {
  owner: string;
  title: string;
  countries: string[];
  inDays: number;
  public: boolean;
  days: {
    city: string;
    notes: string;
    activities: DemoActivity[];
    budgets?: DemoBudget[];
  }[];
  transport: {
    onDay: number;
    mode: 'flight' | 'train' | 'bus' | 'car' | 'ferry' | 'other';
    from: string;
    to: string;
    amount: number;
    currency: string;
  };
};
const ITINERARIES: DemoItinerary[] = [
  {
    owner: 'demo.user',
    title: 'Cairo and Dubai in 5 days',
    countries: ['EG', 'AE'],
    inDays: 20,
    public: true,
    days: [
      {
        city: 'cairo',
        notes: 'Demo itinerary: arrive and see the pyramids.',
        activities: [
          {
            name: 'Giza Pyramids and Sphinx',
            description: 'Sunrise visit with a local guide.',
            time: '06:30',
            cost: 700,
            currency: 'EGP',
          },
        ],
        budgets: [
          { category: 'food', amount: 1500, currency: 'EGP' },
          { category: 'accommodation', amount: 90, currency: 'USD' },
        ],
      },
      {
        city: 'cairo',
        notes: 'Old Cairo walk.',
        activities: [
          {
            name: 'Walk in Old Cairo',
            description: 'Markets and coffee.',
            time: '10:00',
          },
        ],
        budgets: [
          { category: 'in_city_transport', amount: 300, currency: 'EGP' },
        ],
      },
      {
        city: 'dubai',
        notes: 'Fly to Dubai in the morning.',
        activities: [
          {
            name: 'Burj Khalifa Observation Deck',
            description: 'Evening visit for the city lights.',
            time: '18:00',
            cost: 179,
            currency: 'AED',
          },
        ],
        budgets: [{ category: 'food', amount: 250, currency: 'AED' }],
      },
    ],
    transport: {
      onDay: 3,
      mode: 'flight',
      from: 'cairo',
      to: 'dubai',
      amount: 150,
      currency: 'USD',
    },
  },
  {
    owner: 'demo.user',
    title: 'Weekend in London',
    countries: ['GB'],
    inDays: 10,
    public: false,
    days: [
      {
        city: 'london',
        notes: 'Demo itinerary (private): museums day.',
        activities: [
          {
            name: 'British Museum',
            description: 'Free entry; book a time slot.',
            time: '10:00',
          },
        ],
        budgets: [{ category: 'food', amount: 40, currency: 'GBP' }],
      },
      {
        city: 'london',
        notes: 'Back home in the evening.',
        activities: [
          { name: 'Shopping', description: 'Last souvenirs.', time: '11:00' },
        ],
      },
    ],
    transport: {
      onDay: 1,
      mode: 'flight',
      from: 'cairo',
      to: 'london',
      amount: 150,
      currency: 'USD',
    },
  },
  {
    owner: 'demo.traveler1',
    title: 'Paris and Frankfurt by train',
    countries: ['FR', 'DE'],
    inDays: 30,
    public: true,
    days: [
      {
        city: 'paris',
        notes: 'Demo itinerary: a full day at the Louvre.',
        activities: [
          {
            name: 'Louvre Museum',
            description: 'Start with the Denon wing.',
            time: '09:00',
            cost: 22,
            currency: 'EUR',
          },
        ],
        budgets: [{ category: 'food', amount: 45, currency: 'EUR' }],
      },
      {
        city: 'frankfurt',
        notes: 'Morning train to Frankfurt.',
        activities: [
          {
            name: 'Römerberg',
            description: 'Old town square and the river walk.',
            time: '15:00',
          },
        ],
        budgets: [{ category: 'accommodation', amount: 110, currency: 'EUR' }],
      },
    ],
    transport: {
      onDay: 2,
      mode: 'train',
      from: 'paris',
      to: 'frankfurt',
      amount: 80,
      currency: 'EUR',
    },
  },
  {
    owner: 'demo.traveler2',
    title: 'Tokyo for the first time',
    countries: ['JP'],
    inDays: 45,
    public: true,
    days: [
      {
        city: 'tokyo',
        notes: 'Demo itinerary: temples and food.',
        activities: [
          {
            name: 'Senso-ji Temple',
            description: 'Go early to avoid the crowds.',
            time: '08:00',
          },
        ],
        budgets: [{ category: 'food', amount: 5000, currency: 'JPY' }],
      },
      {
        city: 'tokyo',
        notes: 'City day.',
        activities: [
          {
            name: 'Ramen tasting',
            description: 'Three small bowls in three shops.',
            time: '12:00',
            cost: 3000,
            currency: 'JPY',
          },
        ],
        budgets: [
          { category: 'in_city_transport', amount: 1500, currency: 'JPY' },
        ],
      },
    ],
    transport: {
      onDay: 1,
      mode: 'flight',
      from: 'dubai',
      to: 'tokyo',
      amount: 650,
      currency: 'USD',
    },
  },
  {
    owner: 'demo.traveler3',
    title: 'New York city break',
    countries: ['US'],
    inDays: 25,
    public: true,
    days: [
      {
        city: 'new_york',
        notes: 'Demo itinerary: the park and the city.',
        activities: [
          {
            name: 'Central Park',
            description: 'Rent a bike for two hours.',
            time: '10:00',
            cost: 30,
            currency: 'USD',
          },
        ],
        budgets: [{ category: 'food', amount: 60, currency: 'USD' }],
      },
      {
        city: 'new_york',
        notes: 'Museum day.',
        activities: [
          {
            name: 'Museum visit',
            description: 'Pick one museum and take it slow.',
            time: '11:00',
          },
        ],
      },
    ],
    transport: {
      onDay: 1,
      mode: 'flight',
      from: 'london',
      to: 'new_york',
      amount: 500,
      currency: 'USD',
    },
  },
  {
    owner: 'demo.traveler3',
    title: 'Riyadh long weekend',
    countries: ['SA'],
    inDays: 15,
    public: true,
    days: [
      {
        city: 'riyadh',
        notes: 'Demo itinerary: the city from above.',
        activities: [
          {
            name: 'Kingdom Centre Tower (Sky Bridge)',
            description: 'Go before sunset.',
            time: '17:00',
            cost: 69,
            currency: 'SAR',
          },
        ],
        budgets: [{ category: 'food', amount: 200, currency: 'SAR' }],
      },
      {
        city: 'riyadh',
        notes: 'Relaxed day.',
        activities: [
          {
            name: 'Old market',
            description: 'Dates and coffee.',
            time: '10:00',
          },
        ],
      },
    ],
    transport: {
      onDay: 1,
      mode: 'flight',
      from: 'dubai',
      to: 'riyadh',
      amount: 120,
      currency: 'USD',
    },
  },
];
const POSTS: {
  author: string;
  title: string;
  body: string;
  status: 'published' | 'draft';
  tags: string[];
  itinerary?: string;
  comments: { by: string; text: string }[];
  likedBy: string[];
}[] = [
  {
    author: 'demo.user',
    title: 'Seeing the Pyramids at sunrise',
    body: 'Demo post. We reached Giza before 7 am and had the Sphinx almost to ourselves. Bring water and a hat.',
    status: 'published',
    tags: ['cairo', 'history'],
    itinerary: 'Cairo and Dubai in 5 days',
    comments: [
      { by: 'demo.traveler1', text: 'Great tip about going early!' },
      { by: 'demo.traveler2', text: 'Adding this to my list.' },
    ],
    likedBy: ['demo.traveler1', 'demo.traveler2', 'demo.traveler3'],
  },
  {
    author: 'demo.traveler1',
    title: 'Three days of museums in Paris',
    body: 'Demo post. The Louvre needs a full day; plan your route before you go.',
    status: 'published',
    tags: ['paris', 'museums'],
    itinerary: 'Paris and Frankfurt by train',
    comments: [{ by: 'demo.user', text: 'Which wing did you like most?' }],
    likedBy: ['demo.user', 'demo.traveler3'],
  },
  {
    author: 'demo.traveler2',
    title: 'First time in Tokyo: what I learned',
    body: 'Demo post. Get a transit card on day one and visit Senso-ji early in the morning.',
    status: 'published',
    tags: ['tokyo', 'tips'],
    itinerary: 'Tokyo for the first time',
    comments: [
      { by: 'demo.traveler3', text: 'Thanks, very useful.' },
      { by: 'demo.user', text: 'How many days would you stay?' },
    ],
    likedBy: ['demo.user'],
  },
  {
    author: 'demo.traveler3',
    title: 'A walk through Central Park',
    body: 'Demo post. Renting a bike is the easiest way to see the whole park in one morning.',
    status: 'published',
    tags: ['new-york', 'parks'],
    comments: [{ by: 'demo.traveler1', text: 'Nice photos idea for my trip.' }],
    likedBy: ['demo.traveler2'],
  },
  {
    author: 'demo.user',
    title: 'My London packing list',
    body: 'Demo draft. Umbrella, comfortable shoes, an adapter.',
    status: 'draft',
    tags: ['london'],
    comments: [],
    likedBy: [],
  },
];

/** YYYY-MM-DD of today (UTC) plus a number of days. */
function day(offset: number): string {
  return new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
}

/** One browser: keeps its cookies between requests. */
class Session {
  private cookies = new Map<string, string>();
  constructor(private readonly baseUrl: string) {}

  async send(
    method: string,
    path: string,
    body?: unknown,
    form?: Record<string, string>,
  ) {
    const headers: Record<string, string> = {};
    if (this.cookies.size > 0) {
      headers.cookie = [...this.cookies]
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    }
    let payload: BodyInit | undefined;
    if (form) {
      const data = new FormData();
      for (const [k, v] of Object.entries(form)) data.append(k, v);
      payload = data;
    } else if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: payload,
    });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const at = pair.indexOf('=');
      this.cookies.set(pair.slice(0, at).trim(), pair.slice(at + 1));
    }
    return { status: res.status, text: await res.text() };
  }
}

/** Throws with the API's answer unless the status is one of `ok`. */
function expectStatus(
  res: { status: number; text: string },
  ok: number[],
  what: string,
) {
  if (!ok.includes(res.status)) {
    throw new Error(`${what}: HTTP ${res.status} ${res.text}`);
  }
}

export async function seedDemo(options: SeedDemoOptions): Promise<string[]> {
  const { baseUrl, db, demoPassword } = options;
  const log: string[] = [];
  const session = () => new Session(baseUrl);

  async function logIn(email: string, password: string) {
    const s = session();
    const res = await s.send('POST', '/api/auth/login', { email, password });
    return res.status === 200 ? s : null;
  }

  const admin = await logIn(options.adminEmail, options.adminPassword);
  if (!admin)
    throw new Error(
      'The seeded admin cannot log in (ADMIN_EMAIL / ADMIN_PASSWORD).',
    );

  // A moderator logged in with DEMO_PASSWORD, created by the admin (ACC-13) when missing.
  async function moderator(
    email: string,
    name: string,
    role: 'airline_moderator' | 'hotel_moderator',
    providerId: string,
  ): Promise<Session> {
    const existing = await logIn(email, demoPassword);
    if (existing) {
      log.push(`exists: ${email}`);
      return existing;
    }
    if (await db.collection('users').findOne({ email })) {
      throw new Error(
        `${email} exists but does not log in with DEMO_PASSWORD.`,
      );
    }
    const temporaryPassword = `Tmp${Math.random().toString(36).slice(2, 10)}9`;
    const created = await admin!.send('POST', '/api/admin/moderators', {
      name,
      email,
      role,
      providerId,
      temporaryPassword,
    });
    expectStatus(created, [201], `create moderator ${email}`);
    const s = await logIn(email, temporaryPassword);
    if (!s)
      throw new Error(`${email} cannot log in with its temporary password.`);
    const changed = await s.send('PATCH', '/api/auth/change-password', {
      currentPassword: temporaryPassword,
      newPassword: demoPassword,
    });
    expectStatus(changed, [200], `set the password of ${email}`);
    log.push(`created: ${email}`);
    return (await logIn(email, demoPassword))!;
  }

  // 1. The registered user (ACC-01).
  const userEmail = `demo.user${DEMO_DOMAIN}`;
  if (await logIn(userEmail, demoPassword)) {
    log.push(`exists: ${userEmail}`);
  } else {
    const res = await session().send('POST', '/api/auth/register', {
      name: 'Demo User',
      email: userEmail,
      password: demoPassword,
      acceptTerms: true,
    });
    expectStatus(res, [201], `register ${userEmail}`);
    log.push(`created: ${userEmail}`);
  }

  // 2. Demo Air, its moderator, policies and flights (FLT-01, FLT-03, FLT-04, FLT-08, FLT-09).
  let airline = await db.collection('airlines').findOne({ code: 'DA' });
  if (!airline) {
    const res = await admin.send('POST', '/api/airlines', undefined, {
      name: 'Demo Air',
      code: 'DA',
    });
    expectStatus(res, [201], 'create Demo Air');
    airline = await db.collection('airlines').findOne({ code: 'DA' });
    log.push('created: airline Demo Air (DA)');
  }
  const airlineId = String(airline!._id);
  const airlineMod = await moderator(
    `demo.airline${DEMO_DOMAIN}`,
    'Demo Airline Moderator',
    'airline_moderator',
    airlineId,
  );
  expectStatus(
    await airlineMod.send('PUT', `/api/airlines/${airlineId}/baggage-policy`, {
      extraBagPrice: 5000,
      maxExtraBagsPerPassenger: 2,
    }),
    [200],
    'Demo Air baggage policy',
  );
  expectStatus(
    await airlineMod.send(
      'PUT',
      `/api/airlines/${airlineId}/cancellation-policy`,
      { tiers: TIERS },
    ),
    [200],
    'Demo Air cancellation tiers',
  );
  for (const f of FLIGHTS) {
    const departureDate = day(f.inDays);
    let flight = await db.collection('flights').findOne({
      airlineId: airline!._id,
      flightNumber: f.number,
      departureDate,
    });
    if (!flight) {
      const res = await airlineMod.send('POST', '/api/flights', {
        flightNumber: f.number,
        departureAirport: f.from,
        arrivalAirport: f.to,
        departureLocal: `${departureDate}T${f.dep}`,
        arrivalLocal: `${day(f.inDays + f.arrDays)}T${f.arr}`,
      });
      expectStatus(res, [201], `create flight ${f.number} ${departureDate}`);
      flight = await db.collection('flights').findOne({
        airlineId: airline!._id,
        flightNumber: f.number,
        departureDate,
      });
      log.push(
        `created: flight ${f.number} ${f.from}-${f.to} ${departureDate}`,
      );
    }
    const have = new Set(
      ((flight!.cabins ?? []) as { cabinClass: string }[]).map(
        (c) => c.cabinClass,
      ),
    );
    for (const cabin of CABINS.filter((c) => !have.has(c.cabinClass))) {
      const res = await airlineMod.send(
        'POST',
        `/api/flights/${String(flight!._id)}/cabins`,
        cabin,
      );
      expectStatus(res, [201], `add ${cabin.cabinClass} to ${f.number}`);
    }
  }

  // 3. One hotel per seeded city, each with its own moderator, policies and rooms
  //    (HTL-01, HTL-03, HTL-04, HTL-09, HTL-10, ACC-13).
  const cities = await db
    .collection('cities')
    .find()
    .sort({ _id: 1 })
    .toArray();
  for (const city of cities) {
    const cityId = String(city._id);
    const name = `Demo Hotel ${city.name}`;
    let hotel = await db.collection('hotels').findOne({ name });
    if (!hotel) {
      const res = await admin.send('POST', '/api/hotels', undefined, {
        name,
        address: '1 Demo Street',
        cityId,
        countryCode: String(city.countryCode),
        description: `Demo data: a hotel in ${city.name} for testing the platform.`,
        starRating: '4',
      });
      expectStatus(res, [201], `create ${name}`);
      hotel = await db.collection('hotels').findOne({ name });
      log.push(`created: ${name}`);
    }
    const hotelId = String(hotel!._id);
    const hotelMod = await moderator(
      `demo.hotel.${cityId}${DEMO_DOMAIN}`,
      `Demo Hotel Moderator (${city.name})`,
      'hotel_moderator',
      hotelId,
    );
    expectStatus(
      await hotelMod.send('PUT', `/api/hotels/${hotelId}/policies`, {
        checkInTime: '14:00',
        checkOutTime: '12:00',
        cancellationTiers: TIERS,
      }),
      [200],
      `${name} policies`,
    );
    for (const r of ROOMS) {
      let room = await db
        .collection('rooms')
        .findOne({ hotelId: hotel!._id, roomNumber: r.roomNumber });
      if (!room) {
        const res = await hotelMod.send(
          'POST',
          `/api/hotels/${hotelId}/rooms`,
          r,
        );
        expectStatus(res, [201], `${name} room ${r.roomNumber}`);
        room = await db
          .collection('rooms')
          .findOne({ hotelId: hotel!._id, roomNumber: r.roomNumber });
      }
      // 409 = this range is already (partly) bookable from an earlier run.
      const range = await hotelMod.send(
        'POST',
        `/api/hotels/${hotelId}/rooms/${String(room!._id)}/availability`,
        { from: day(1), to: day(60) },
      );
      expectStatus(
        range,
        [201, 409],
        `${name} room ${r.roomNumber} availability`,
      );
    }
  }

  // 4. More travellers, so posts, itineraries, comments and likes come from different people (ACC-01).
  const travellers: Record<string, Session> = {
    [userEmail]: (await logIn(userEmail, demoPassword))!,
  };
  for (const t of TRAVELLERS) {
    const email = `${t.handle}${DEMO_DOMAIN}`;
    let s = await logIn(email, demoPassword);
    if (s) {
      log.push(`exists: ${email}`);
    } else {
      const res = await session().send('POST', '/api/auth/register', {
        name: t.name,
        email,
        password: demoPassword,
        acceptTerms: true,
      });
      expectStatus(res, [201], `register ${email}`);
      s = await logIn(email, demoPassword);
      log.push(`created: ${email}`);
    }
    travellers[email] = s!;
  }
  const as = (handle: string) => travellers[`${handle}${DEMO_DOMAIN}`];
  const userIdOf = async (handle: string) =>
    (await db
      .collection('users')
      .findOne({ email: `${handle}${DEMO_DOMAIN}` }))!._id;

  // 5. Itineraries with days, activities, budgets and transport (ITN-01, ITN-05, ITN-10, ITN-14,
  //    ITN-16, ITN-20). Built private, then made public, so a half-built one is never shown.
  const itineraryIds: Record<string, string> = {};
  for (const it of ITINERARIES) {
    const owner = as(it.owner);
    const existing = await db.collection('itineraries').findOne({
      userId: await userIdOf(it.owner),
      title: it.title,
    });
    if (existing) {
      itineraryIds[it.title] = String(existing._id);
      log.push(`exists: itinerary "${it.title}"`);
      continue;
    }
    const created = await owner.send('POST', '/api/itineraries', {
      title: it.title,
      countryCodes: it.countries,
      startDate: day(it.inDays),
    });
    expectStatus(created, [201], `create itinerary "${it.title}"`);
    const id = (JSON.parse(created.text) as { id: string }).id;
    itineraryIds[it.title] = id;
    const dayIds: string[] = [];
    for (const d of it.days) {
      const added = await owner.send('POST', `/api/itineraries/${id}/days`, {
        cityId: d.city,
        notes: d.notes,
      });
      expectStatus(added, [201], `"${it.title}" add day in ${d.city}`);
      const dayId = (JSON.parse(added.text) as { id: string }).id;
      dayIds.push(dayId);
      for (const a of d.activities) {
        expectStatus(
          await owner.send(
            'POST',
            `/api/itineraries/${id}/days/${dayId}/activities`,
            a,
          ),
          [201],
          `"${it.title}" activity ${a.name}`,
        );
      }
      for (const b of d.budgets ?? []) {
        expectStatus(
          await owner.send(
            'POST',
            `/api/itineraries/${id}/days/${dayId}/budgets`,
            b,
          ),
          [201],
          `"${it.title}" budget ${b.category}`,
        );
      }
    }
    const tr = it.transport;
    expectStatus(
      await owner.send('POST', `/api/itineraries/${id}/transport-costs`, {
        dayId: dayIds[tr.onDay - 1],
        mode: tr.mode,
        fromCityId: tr.from,
        toCityId: tr.to,
        amount: tr.amount,
        currency: tr.currency,
      }),
      [201],
      `"${it.title}" transport`,
    );
    if (it.public) {
      expectStatus(
        await owner.send('PATCH', `/api/itineraries/${id}`, {
          visibility: 'public',
        }),
        [200],
        `"${it.title}" make public`,
      );
    }
    log.push(`created: itinerary "${it.title}"`);
  }

  // 6. Blog posts with tags, an attached itinerary, comments and likes from other travellers
  //    (BLG-01, BLG-05, BLG-06, BLG-08, BLG-13).
  const postIds: Record<string, string> = {};
  for (const p of POSTS) {
    const author = as(p.author);
    const existing = await db.collection('posts').findOne({
      author: await userIdOf(p.author),
      title: p.title,
    });
    if (existing) {
      postIds[p.title] = String(existing._id);
      log.push(`exists: post "${p.title}"`);
      continue;
    }
    const created = await author.send('POST', '/api/posts', {
      title: p.title,
      body: p.body,
      status: p.status,
      tags: p.tags,
    });
    expectStatus(created, [201], `create post "${p.title}"`);
    const id = (JSON.parse(created.text) as { id: string }).id;
    postIds[p.title] = id;
    if (p.itinerary) {
      expectStatus(
        await author.send('PATCH', `/api/posts/${id}/itinerary`, {
          itineraryId: itineraryIds[p.itinerary],
        }),
        [200],
        `attach "${p.itinerary}" to "${p.title}"`,
      );
    }
    for (const c of p.comments) {
      expectStatus(
        await as(c.by).send('POST', `/api/posts/${id}/comments`, {
          text: c.text,
        }),
        [201],
        `comment on "${p.title}"`,
      );
    }
    for (const liker of p.likedBy) {
      expectStatus(
        await as(liker).send('POST', `/api/posts/${id}/like`),
        [200, 201],
        `like "${p.title}"`,
      );
    }
    log.push(`created: post "${p.title}" (${p.status})`);
  }

  // 7. Two open reports for the admin (GEN-09); 409 = already reported by that person.
  const reports = [
    {
      by: 'demo.traveler2',
      contentType: 'post',
      contentId: postIds['A walk through Central Park'],
    },
    {
      by: 'demo.traveler1',
      contentType: 'itinerary',
      contentId: itineraryIds['Riyadh long weekend'],
    },
  ];
  for (const r of reports) {
    expectStatus(
      await as(r.by).send('POST', '/api/reports', {
        contentType: r.contentType,
        contentId: r.contentId,
        reason: 'Demo report (test data): please check this content.',
      }),
      [201, 409],
      `report ${r.contentType}`,
    );
  }

  // 8. Favourites of the demo user (BON-02); 409 = already a favourite.
  const parisHotel = await db
    .collection('hotels')
    .findOne({ name: 'Demo Hotel Paris' });
  for (const f of [
    { type: 'hotel', targetId: String(parisHotel!._id) },
    {
      type: 'itinerary',
      targetId: itineraryIds['Paris and Frankfurt by train'],
    },
  ]) {
    expectStatus(
      await as('demo.user').send('POST', '/api/favourites', f),
      [201, 409],
      `favourite ${f.type}`,
    );
  }

  // 9. One paid flight and one paid hotel stay for the demo user (FLT-22, HTL-16, PAY-02, PAY-01),
  //    paid with Stripe's test card; the booking is confirmed by the real Stripe webhook.
  if (options.payments === false) {
    log.push('skipped: paid bookings (no Stripe webhook forwarding)');
    return log;
  }
  const user = as('demo.user');
  const hasConfirmed = async (path: string) => {
    const res = await user.send('GET', `${path}?group=upcoming`);
    const items = (JSON.parse(res.text) as { items: { status: string }[] })
      .items;
    return items.some((b) => b.status === 'confirmed');
  };
  async function payAndWait(kind: 'flight' | 'hotel', bookingId: string) {
    const path = kind === 'flight' ? 'flight-bookings' : 'hotel-bookings';
    expectStatus(
      await user.send(
        'POST',
        `/api/bookings/${kind}/${bookingId}/accept-policies`,
        { accepted: true },
      ),
      [200],
      `accept ${kind} policies`,
    );
    expectStatus(
      await user.send('POST', '/api/payments', {
        bookingType: kind,
        bookingId,
        paymentMethodId: 'pm_card_visa',
      }),
      [201],
      `pay ${kind} booking`,
    );
    for (let i = 0; i < 90; i++) {
      const res = await user.send('GET', `/api/${path}/${bookingId}`);
      if ((JSON.parse(res.text) as { status: string }).status === 'confirmed')
        return;
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error(
      `${kind} booking ${bookingId} was not confirmed: is the Stripe webhook forwarded?`,
    );
  }
  if (await hasConfirmed('/api/flight-bookings')) {
    log.push('exists: paid flight booking of demo.user');
  } else {
    const flight = await db.collection('flights').findOne({
      airlineId: airline!._id,
      flightNumber: 'DA201',
      departureDate: day(10),
    });
    const hold = await user.send('POST', '/api/flight-bookings/hold', {
      segments: [{ flightId: String(flight!._id), cabinClass: 'economy' }],
      passengers: [
        {
          type: 'adult',
          fullName: 'Demo User',
          dateOfBirth: '1995-05-05',
          passportNumber: 'A1234567',
        },
      ],
    });
    expectStatus(hold, [201], 'hold DA201');
    await payAndWait('flight', (JSON.parse(hold.text) as { id: string }).id);
    log.push('created: paid flight booking DA201 CAI-LHR for demo.user');
  }
  if (await hasConfirmed('/api/hotel-bookings')) {
    log.push('exists: paid hotel reservation of demo.user');
  } else {
    const hotel = await db
      .collection('hotels')
      .findOne({ name: 'Demo Hotel London' });
    const room = await db
      .collection('rooms')
      .findOne({ hotelId: hotel!._id, roomNumber: '102' });
    const booking = await user.send('POST', '/api/hotel-bookings', {
      hotelId: String(hotel!._id),
      checkIn: day(10),
      checkOut: day(13),
      rooms: [{ roomId: String(room!._id), adults: 2 }],
    });
    expectStatus(booking, [201], 'book Demo Hotel London');
    await payAndWait('hotel', (JSON.parse(booking.text) as { id: string }).id);
    log.push('created: paid stay at Demo Hotel London for demo.user');
  }
  return log;
}

// npm run seed:demo: starts the application in this process (no server needed), seeds, stops.
if (require.main === module) {
  void (async () => {
    const envFile = join(__dirname, '..', '..', '.env');
    if (existsSync(envFile)) process.loadEnvFile(envFile);
    const demoPassword = process.env.DEMO_PASSWORD ?? '';
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(demoPassword)) {
      console.error(
        'Set DEMO_PASSWORD in backend/.env: at least 8 characters with a letter and a digit (ACC-01).',
      );
      process.exit(1);
    }
    // Paid bookings need Stripe's webhook: the Stripe CLI forwards it to this process (test keys only).
    const stripeKey = process.env.STRIPE_SECRET_KEY ?? '';
    let webhookSecret = '';
    if (/^(sk|rk)_test_/.test(stripeKey)) {
      try {
        webhookSecret = execFileSync(
          'stripe',
          ['listen', '--print-secret', '--api-key', stripeKey],
          { encoding: 'utf8' },
        ).trim();
      } catch {
        webhookSecret = '';
      }
    }
    if (webhookSecret.startsWith('whsec_')) {
      process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
    } else {
      console.warn(
        'Stripe CLI or a test STRIPE_SECRET_KEY is missing: the paid bookings are skipped.',
      );
    }
    const app = await NestFactory.create(AppModule, {
      rawBody: true,
      logger: ['error', 'warn'],
    });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    const server = app.getHttpServer() as Server;
    const port = (server.address() as AddressInfo).port;
    let listener: ChildProcess | undefined;
    try {
      if (webhookSecret.startsWith('whsec_')) {
        listener = await forwardStripeWebhook(stripeKey, port);
      }
      const log = await seedDemo({
        baseUrl: `http://127.0.0.1:${port}`,
        db: app.get<Connection>(getConnectionToken()),
        adminEmail: process.env.ADMIN_EMAIL ?? '',
        adminPassword: process.env.ADMIN_PASSWORD ?? '',
        demoPassword,
        payments: listener !== undefined,
      });
      console.log(log.join('\n'));
      console.log(
        'Demo data ready. Every demo account logs in with DEMO_PASSWORD.',
      );
    } catch (err) {
      console.error((err as Error).message);
      process.exitCode = 1;
    } finally {
      listener?.kill();
      await app.close();
    }
  })();
}

/** Starts `stripe listen` forwarding the payment events to this process and waits until it is ready. */
function forwardStripeWebhook(
  apiKey: string,
  port: number,
): Promise<ChildProcess | undefined> {
  const listener = spawn(
    'stripe',
    [
      'listen',
      '--api-key',
      apiKey,
      '--events',
      'payment_intent.succeeded,payment_intent.payment_failed,payment_intent.canceled,refund.created,refund.updated,refund.failed',
      '--forward-to',
      `127.0.0.1:${port}/api/payments/webhook`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      listener.kill();
      console.warn(
        'stripe listen did not start: the paid bookings are skipped.',
      );
      resolve(undefined);
    }, 60_000);
    const onData = (chunk: Buffer) => {
      if (chunk.toString().includes('Ready!')) {
        clearTimeout(timer);
        listener.stdout.resume();
        listener.stderr.resume();
        resolve(listener);
      }
    };
    listener.stdout.on('data', onData);
    listener.stderr.on('data', onData);
    listener.on('error', () => {
      clearTimeout(timer);
      resolve(undefined);
    });
  });
}
