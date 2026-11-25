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

  // source: the team leader's choices of 25 Nov 2026 (popup): 3 more demo travellers, public and
  // private itineraries, blog posts with comments and likes, paid bookings, reports and favourites,
  // demo text written by the assistant from the official Mock Data cities and attractions.
  const TRAVELLERS = ['demo.traveler1', 'demo.traveler2', 'demo.traveler3'];
  const PUBLIC_ITINERARIES = [
    'Cairo and Dubai in 5 days',
    'Paris and Frankfurt by train',
    'Tokyo for the first time',
    'New York city break',
    'Riyadh long weekend',
  ];
  const PRIVATE_ITINERARY = 'Weekend in London';
  const PUBLISHED_POSTS = [
    'Seeing the Pyramids at sunrise',
    'Three days of museums in Paris',
    'First time in Tokyo: what I learned',
    'A walk through Central Park',
  ];
  const DRAFT_POST = 'My London packing list';

  test('three more demo travellers log in as registered users (ACC-01, ACC-04)', async () => {
    for (const name of TRAVELLERS) {
      const { me } = await logIn(`${name}${DOMAIN}`);
      expect(me.role).toBe('user');
    }
  });

  test('a guest finds each public demo itinerary with its days, activities, budget and transport (ITN-21, ITN-05, ITN-10, ITN-14, ITN-16)', async () => {
    for (const title of PUBLIC_ITINERARIES) {
      const search = await t.guest().get('/api/itineraries/public/search', {
        query: { keyword: title },
      });
      expect(search.status).toBe(200);
      const found = (search.body.items as { id: string; title: string }[]).find(
        (i) => i.title === title,
      );
      expect(found).toBeDefined();
      const view = await t.guest().get(`/api/itineraries/public/${found!.id}`);
      expect(view.status).toBe(200);
      const days = view.body.days as {
        activities: unknown[];
        budgets: unknown[];
      }[];
      expect(days.length).toBeGreaterThanOrEqual(2);
      expect(days.every((d) => d.activities.length > 0)).toBe(true);
      expect(days.some((d) => d.budgets.length > 0)).toBe(true);
      expect(view.body.transportCosts.length).toBeGreaterThan(0);
    }
  });

  test('the private demo itinerary is only in its owner list (ITN-20, ITN-03)', async () => {
    const search = await t.guest().get('/api/itineraries/public/search', {
      query: { keyword: PRIVATE_ITINERARY },
    });
    const titles = (search.body.items as { title: string }[]).map(
      (i) => i.title,
    );
    expect(titles).not.toContain(PRIVATE_ITINERARY);
    const { client } = await logIn(`demo.user${DOMAIN}`);
    const mine = await client.get('/api/itineraries');
    const own = (mine.body.items as { title: string }[]).map((i) => i.title);
    expect(own).toContain(PRIVATE_ITINERARY);
  });

  test('published demo posts are in the blog with likes and comments; the draft is not (BLG-01, BLG-02, BLG-05, BLG-06)', async () => {
    for (const title of PUBLISHED_POSTS) {
      const res = await t
        .guest()
        .get('/api/posts', { query: { keyword: title } });
      expect(res.status).toBe(200);
      const post = (
        res.body.items as {
          title: string;
          likeCount: number;
          commentCount: number;
        }[]
      ).find((p) => p.title === title);
      expect(post).toBeDefined();
      expect(post!.likeCount).toBeGreaterThan(0);
      expect(post!.commentCount).toBeGreaterThan(0);
    }
    const draft = await t
      .guest()
      .get('/api/posts', { query: { keyword: DRAFT_POST } });
    const titles = (draft.body.items as { title: string }[]).map(
      (p) => p.title,
    );
    expect(titles).not.toContain(DRAFT_POST);
  });

  test('the demo user has a paid flight booking and a paid hotel reservation (PAY-01, FLT-23, HTL-17)', async () => {
    const { client } = await logIn(`demo.user${DOMAIN}`);
    for (const path of ['/api/flight-bookings', '/api/hotel-bookings']) {
      const res = await client.get(path, { query: { group: 'upcoming' } });
      expect(res.status).toBe(200);
      const statuses = (res.body.items as { status: string }[]).map(
        (b) => b.status,
      );
      expect(statuses).toContain('confirmed');
    }
  });

  test('the admin sees open demo reports (GEN-09)', async () => {
    const admin = await t.admin();
    const res = await admin.get('/api/admin/reports', {
      query: { status: 'open' },
    });
    expect(res.status).toBe(200);
    const reporters = (
      res.body.items as { reporter?: { email: string } }[]
    ).filter((r) => r.reporter?.email.endsWith(DOMAIN));
    expect(reporters.length).toBeGreaterThanOrEqual(2);
  });

  test('the demo user has a favourite hotel and a favourite itinerary (BON-02)', async () => {
    const { client } = await logIn(`demo.user${DOMAIN}`);
    for (const type of ['hotel', 'itinerary']) {
      const res = await client.get('/api/favourites', { query: { type } });
      expect(res.status).toBe(200);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
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
      // Only the demo hotels' rooms: other suites share this database and add rooms of their own.
      rooms: await t.collection('rooms').countDocuments({
        hotelId: {
          $in: await t
            .collection('hotels')
            .distinct('_id', { name: { $regex: '^Demo Hotel' } }),
        },
      }),
    });
    const demoUsers = await t.collection('users').distinct('_id', {
      email: { $regex: `${DOMAIN.replace('.', '\\.')}$` },
    });
    const content = async () => ({
      itineraries: await t
        .collection('itineraries')
        .countDocuments({ userId: { $in: demoUsers } }),
      posts: await t
        .collection('posts')
        .countDocuments({ author: { $in: demoUsers } }),
      flightBookings: await t
        .collection('flightbookings')
        .countDocuments({ userId: { $in: demoUsers } }),
      hotelBookings: await t
        .collection('hotelbookings')
        .countDocuments({ userId: { $in: demoUsers } }),
      favourites: await t
        .collection('favourites')
        .countDocuments({ userId: { $in: demoUsers } }),
    });
    const before = await count();
    // 4 travellers + 1 airline moderator + 8 hotel moderators; 8 hotels x 3 rooms.
    expect(before).toEqual({
      users: 13,
      airlines: 1,
      flights: 6,
      hotels: 8,
      rooms: 24,
    });
    // 6 itineraries, 4 published posts + 1 draft, 1 paid flight, 1 paid stay, 2 favourites.
    const contentBefore = await content();
    expect(contentBefore).toEqual({
      itineraries: 6,
      posts: 5,
      flightBookings: 1,
      hotelBookings: 1,
      favourites: 2,
    });
    await run();
    expect(await count()).toEqual(before);
    expect(await content()).toEqual(contentBefore);
  }, 600_000);
});
