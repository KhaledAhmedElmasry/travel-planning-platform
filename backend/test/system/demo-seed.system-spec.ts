// The demo data script (npm run seed:demo), run against the real application on a throwaway database.
// source: the demo data the team leader approved on 23 Nov 2026: 1 registered user, airline "Demo Air"
// (code DA) with its moderator, 6 future flights between CAI / DXB / LHR with all 4 cabin classes and
// its baggage policy and cancellation tiers, one "Demo Hotel <City>" per seeded city with its own
// moderator and 3 bookable rooms, all logging in with DEMO_PASSWORD, and safe to run twice.
// The data must also satisfy the Excel rules it goes through: ACC-01, ACC-13, FLT-03, FLT-04, FLT-08,
// FLT-09, FLT-11, HTL-03, HTL-04, HTL-09, HTL-10, HTL-11.
import { Client, TestApp, day } from '../support/harness';
import { seedDemo } from '../../src/database/seed-demo';

const DEMO_PASSWORD = 'Dem0Passw0rd';
const DOMAIN = '@yallaway.local';
// source: Mock Data UPDATED.xlsx, Cities.csv (the 8 seeded cities and their countries)
const CITIES: [string, string][] = [
  ['cairo', 'EG'],
  ['dubai', 'AE'],
  ['london', 'GB'],
  ['new_york', 'US'],
  ['paris', 'FR'],
  ['tokyo', 'JP'],
  ['riyadh', 'SA'],
  ['frankfurt', 'DE'],
];
const CABIN_CLASSES = ['business', 'economy', 'first', 'premium_economy'];

describe('Demo data (npm run seed:demo)', () => {
  const t = new TestApp();
  const run = () =>
    seedDemo({
      baseUrl: t.baseUrl,
      db: t.db,
      adminEmail: process.env.ADMIN_EMAIL as string,
      adminPassword: process.env.ADMIN_PASSWORD as string,
      demoPassword: DEMO_PASSWORD,
    });

  async function logIn(email: string): Promise<{ client: Client; me: any }> {
    const client = t.guest();
    const login = await client.post('/api/auth/login', {
      email,
      password: DEMO_PASSWORD,
    });
    expect(login.status).toBe(200);
    const me = await client.get('/api/auth/me');
    return { client, me: me.body };
  }

  async function demoFlights() {
    const airline = await t.collection('airlines').findOne({ code: 'DA' });
    return t
      .collection('flights')
      .find({ airlineId: airline?._id, departureAt: { $gt: new Date() } })
      .toArray();
  }

  beforeAll(async () => {
    await t.start();
    await run();
  }, 600_000);
  afterAll(() => t.stop());

  test('the demo user logs in as a registered user (ACC-01, ACC-04)', async () => {
    const { me } = await logIn(`demo.user${DOMAIN}`);
    expect(me.role).toBe('user');
  });

  test('the demo airline moderator manages Demo Air (DA) and needs no password change (ACC-13)', async () => {
    const { me } = await logIn(`demo.airline${DOMAIN}`);
    expect(me.role).toBe('airline_moderator');
    expect(me.mustChangePassword).toBe(false);
    const airline = await t.guest().get(`/api/airlines/${me.airlineId}`);
    expect(airline.status).toBe(200);
    expect(airline.body.name).toBe('Demo Air');
    expect(airline.body.code).toBe('DA');
  });

  test('Demo Air has a baggage policy and cancellation tiers (FLT-08, FLT-09)', async () => {
    const { me } = await logIn(`demo.airline${DOMAIN}`);
    const airline = await t.guest().get(`/api/airlines/${me.airlineId}`);
    expect(airline.body.baggagePolicy.extraBagPrice).toBeGreaterThan(0);
    expect(airline.body.cancellationTiers.length).toBeGreaterThan(0);
  });

  test('Demo Air has 6 future flights between CAI, DXB and LHR, each with the 4 cabin classes (FLT-03, FLT-04)', async () => {
    const flights = await demoFlights();
    expect(flights).toHaveLength(6);
    for (const flight of flights) {
      expect(['CAI', 'DXB', 'LHR']).toContain(flight.departureAirport);
      expect(['CAI', 'DXB', 'LHR']).toContain(flight.arrivalAirport);
      const classes = (flight.cabins as { cabinClass: string }[])
        .map((c) => c.cabinClass)
        .sort();
      expect(classes).toEqual(CABIN_CLASSES);
    }
  });

  test('a guest finds every demo flight in flight search (FLT-11)', async () => {
    const flights = await demoFlights();
    expect(flights).toHaveLength(6);
    for (const flight of flights) {
      const res = await t.guest().get('/api/flights/search', {
        query: {
          origin: flight.departureAirport,
          destination: flight.arrivalAirport,
          departureDate: flight.departureDate,
          adults: 1,
        },
      });
      expect(res.status).toBe(200);
      const numbers = (res.body.items as { flightNumber: string }[]).map(
        (f) => f.flightNumber,
      );
      expect(numbers).toContain(flight.flightNumber);
    }
  });

  test('each seeded city has a demo hotel with its own moderator and 3 rooms (ACC-13, HTL-03)', async () => {
    for (const [cityId, countryCode] of CITIES) {
      const { me } = await logIn(`demo.hotel.${cityId}${DOMAIN}`);
      expect(me.role).toBe('hotel_moderator');
      expect(me.mustChangePassword).toBe(false);
      const hotel = await t
        .collection('hotels')
        .findOne({ _id: t.oid(me.hotelId) });
      expect(hotel?.cityId).toBe(cityId);
      expect(hotel?.countryCode).toBe(countryCode);
      expect(
        await t.collection('rooms').countDocuments({ hotelId: hotel?._id }),
      ).toBe(3);
    }
  });

  test('a guest finds each demo hotel in hotel search for the coming days (HTL-04, HTL-11)', async () => {
    for (const [cityId] of CITIES) {
      const res = await t.guest().get('/api/hotels/search', {
        query: { city: cityId, checkIn: day(5), checkOut: day(7), guests: 2 },
      });
      expect(res.status).toBe(200);
      const names = (res.body.items as { name: string }[]).map((h) => h.name);
      expect(names.some((n) => n.startsWith('Demo Hotel'))).toBe(true);
    }
  });

  test('running it again creates nothing new', async () => {
    const count = async () => ({
      users: await t.collection('users').countDocuments({
        email: { $regex: `${DOMAIN.replace('.', '\\.')}$` },
      }),
      airlines: await t.collection('airlines').countDocuments({ code: 'DA' }),
      flights: (await demoFlights()).length,
      hotels: await t
        .collection('hotels')
        .countDocuments({ name: { $regex: '^Demo Hotel' } }),
      rooms: await t.collection('rooms').countDocuments({}),
    });
    const before = await count();
    // 1 user + 1 airline moderator + 8 hotel moderators; 8 hotels x 3 rooms.
    expect(before).toEqual({
      users: 10,
      airlines: 1,
      flights: 6,
      hotels: 8,
      rooms: 24,
    });
    await run();
    expect(await count()).toEqual(before);
  }, 600_000);
});
