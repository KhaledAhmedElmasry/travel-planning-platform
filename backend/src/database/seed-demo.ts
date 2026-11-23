// Demo data for Milestone 2, run with: npm run seed:demo  (needs DEMO_PASSWORD in backend/.env)
//
// Creates test data so every part of the frontend has something real to show (approved by the team
// leader, 23 Nov 2026). It is NOT a requirement and NOT reference data (that is `npm run seed`):
//   - demo.user@yallaway.local            a registered user
//   - Demo Air (code DA) + demo.airline@yallaway.local, its moderator, baggage policy, cancellation
//     tiers and 6 flights between CAI / DXB / LHR in the next 30 days with all 4 cabin classes
//   - one "Demo Hotel <City>" per seeded city, each with its own moderator
//     (demo.hotel.<cityId>@yallaway.local), policies and 3 rooms bookable for the next 60 days
// Every account logs in with DEMO_PASSWORD. Moderators set it through the normal first-login password
// change (ACC-13), so they never have to change it again.
//
// Everything is created through the public API of the running application, so all the validation,
// ownership and business rules apply (GEN-13). The database is only READ, to find what already exists:
// running the script again creates nothing twice. Flights are dated from "today", so running it on a
// later day adds that day's 6 flights; old ones simply depart.
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
    const app = await NestFactory.create(AppModule, {
      rawBody: true,
      logger: ['error', 'warn'],
    });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    const server = app.getHttpServer() as Server;
    const port = (server.address() as AddressInfo).port;
    try {
      const log = await seedDemo({
        baseUrl: `http://127.0.0.1:${port}`,
        db: app.get<Connection>(getConnectionToken()),
        adminEmail: process.env.ADMIN_EMAIL ?? '',
        adminPassword: process.env.ADMIN_PASSWORD ?? '',
        demoPassword,
      });
      console.log(log.join('\n'));
      console.log(
        'Demo data ready. Every demo account logs in with DEMO_PASSWORD.',
      );
    } catch (err) {
      console.error((err as Error).message);
      process.exitCode = 1;
    } finally {
      await app.close();
    }
  })();
}
