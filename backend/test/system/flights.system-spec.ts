// System tests: airlines, airports, flights, cabins, search and flight details.
// Expected results come from the Excel sheet "Mandatory" (row in brackets), the sheet
// "Airports.csv" of Mock Data.xlsx and the project description section 8.3.
import { FlightStatusJob } from '../../src/flights/flight-status.job';
import { JPG, PNG, TestApp, day } from '../support/harness';
import {
  AirlineSetup,
  addCabin,
  airlineWithModerator,
  bookableFlight,
  createFlight,
} from '../support/scenarios';

describe('Airlines, airports and flights', () => {
  const t = new TestApp();
  let airline: AirlineSetup;
  beforeAll(async () => {
    await t.start();
    airline = await airlineWithModerator(t);
  });
  afterAll(() => t.stop());

  const search = (query: Record<string, string | number | undefined>) =>
    t.guest().get('/api/flights/search', { query });

  describe('FLT-02 airports (Mandatory row 18, sheet Airports.csv)', () => {
    it('lists the predefined airports with IATA code, name, city, country and IANA time zone', async () => {
      const res = await t.guest().get('/api/airports');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(8);
      const byCode = Object.fromEntries(
        (res.body.items as any[]).map((a) => [a.iataCode, a]),
      );
      expect(byCode.CAI).toMatchObject({
        name: 'Cairo International Airport',
        cityId: 'cairo',
        countryCode: 'EG',
        timeZone: 'Africa/Cairo',
      });
      expect(byCode.FRA).toMatchObject({
        name: 'Frankfurt Airport',
        cityId: 'frankfurt',
        countryCode: 'DE',
        timeZone: 'Europe/Berlin',
      });
      expect(Object.keys(byCode).sort()).toEqual(
        ['CAI', 'CDG', 'DXB', 'FRA', 'HND', 'JFK', 'LHR', 'RUH'].sort(),
      );
    });

    it('the list is read-only: there is no way to add, change or delete an airport', async () => {
      const admin = await t.admin();
      for (const call of [
        admin.post('/api/airports', { iataCode: 'XXX' }),
        admin.patch('/api/airports/CAI', { name: 'x' }),
        admin.delete('/api/airports/CAI'),
      ]) {
        expect((await call).status).toBe(404);
      }
    });

    it('flight creation and flight search accept only airports from the list', async () => {
      const res = await airline.moderator.client.post('/api/flights', {
        flightNumber: `${airline.code}1`,
        departureAirport: 'ZZZ',
        arrivalAirport: 'RUH',
        departureLocal: `${day(30)}T10:00`,
        arrivalLocal: `${day(30)}T12:00`,
      });
      expect(res.status).toBe(400);
      const found = await search({
        origin: 'ZZZ',
        destination: 'RUH',
        departureDate: day(30),
      });
      expect(found.status).toBe(400);
    });
  });

  describe('FLT-01 airline profile (Mandatory row 17), GEN-08 logo', () => {
    it('an admin creates an airline; only an admin can', async () => {
      const admin = await t.admin();
      const code = airline.code.split('').reverse().join('') + '9';
      const created = await admin.post('/api/airlines', undefined, {
        fields: { name: 'Nile Air', code: code.slice(0, 3) },
        files: [
          {
            field: 'logo',
            content: PNG,
            filename: 'logo.png',
            contentType: 'image/png',
          },
        ],
      });
      expect([201, 409]).toContain(created.status);
      if (created.status === 201) {
        expect(created.body.name).toBe('Nile Air');
        expect(created.body.logoUrl).toMatch(/^\/uploads\/.+\.png$/);
        // GEN-08: stored on the server and served by URL.
        const file = await t.guest().get(created.body.logoUrl);
        expect(file.status).toBe(200);
        expect(file.buffer.equals(PNG)).toBe(true);
      }
      const fields = { name: 'Not Allowed', code: 'QQ1' };
      expect(
        (
          await airline.moderator.client.post('/api/airlines', undefined, {
            fields,
          })
        ).status,
      ).toBe(403);
      expect(
        (await t.guest().post('/api/airlines', undefined, { fields })).status,
      ).toBe(401);
    });

    it('the airline moderator edits name, code and logo of the own airline only', async () => {
      const mine = await airlineWithModerator(t);
      const edited = await mine.moderator.client.patch(
        `/api/airlines/${mine.airlineId}`,
        undefined,
        {
          fields: { name: 'Renamed Air' },
          files: [
            {
              field: 'logo',
              content: JPG,
              filename: 'logo.jpg',
              contentType: 'image/jpeg',
            },
          ],
        },
      );
      expect(edited.status).toBe(200);
      const shown = await t.guest().get(`/api/airlines/${mine.airlineId}`);
      expect(shown.body.name).toBe('Renamed Air');
      expect(shown.body.logoUrl).toMatch(/\.jpg$/);
      // Another airline's moderator and the admin cannot edit it.
      const other = await airline.moderator.client.patch(
        `/api/airlines/${mine.airlineId}`,
        undefined,
        { fields: { name: 'Hijacked' } },
      );
      expect(other.status).toBe(403);
      // A code that another airline uses is refused.
      const taken = await mine.moderator.client.patch(
        `/api/airlines/${mine.airlineId}`,
        undefined,
        { fields: { code: airline.code } },
      );
      expect(taken.status).toBe(409);
    });

    it('GEN-08: a logo that is not JPG/PNG or is larger than 5 MB is rejected', async () => {
      const mine = await airlineWithModerator(t);
      const upload = (content: Buffer, filename: string, contentType: string) =>
        mine.moderator.client.patch(
          `/api/airlines/${mine.airlineId}`,
          undefined,
          {
            files: [{ field: 'logo', content, filename, contentType }],
          },
        );
      const gif = Buffer.from('GIF89a-not-a-png');
      expect((await upload(gif, 'logo.gif', 'image/gif')).status).toBe(400);
      // A wrong file with a .png name is still rejected.
      expect((await upload(gif, 'logo.png', 'image/png')).status).toBe(400);
      const tooBig = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 1)]);
      expect((await upload(tooBig, 'big.png', 'image/png')).status).toBe(400);
      const justFits = Buffer.concat([
        PNG,
        Buffer.alloc(5 * 1024 * 1024 - PNG.length),
      ]);
      expect((await upload(justFits, 'ok.png', 'image/png')).status).toBe(200);
    });
  });

  describe('FLT-03 create a flight (Mandatory row 19), GEN-06 local times', () => {
    it('takes local times of each airport and stores them in UTC', async () => {
      // DXB is UTC+4 and HND is UTC+9 all year.
      const flight = await createFlight(airline, {
        from: 'DXB',
        to: 'HND',
        inDays: 50,
        departureTime: '10:00',
        arrivalTime: '23:00',
      });
      expect(flight.departureAt).toBe(`${day(50)}T06:00:00.000Z`);
      expect(flight.arrivalAt).toBe(`${day(50)}T14:00:00.000Z`);
      expect(flight.status).toBe('scheduled');
      const stored = await t
        .collection('flights')
        .findOne({ _id: t.oid(flight.id) });
      expect((stored!.departureAt as Date).toISOString()).toBe(
        `${day(50)}T06:00:00.000Z`,
      );
      // GEN-06: shown again in each airport's local time.
      expect(flight.departureLocal).toBe(`${day(50)}T10:00`);
      expect(flight.arrivalLocal).toBe(`${day(50)}T23:00`);
      expect(flight.durationMinutes).toBe(480);
    });

    const attempt = (overrides: Record<string, string>) =>
      airline.moderator.client.post('/api/flights', {
        flightNumber: `${airline.code}777`,
        departureAirport: 'HND',
        arrivalAirport: 'DXB',
        departureLocal: `${day(60)}T10:00`,
        arrivalLocal: `${day(60)}T16:00`,
        ...overrides,
      });

    it('rejects identical airports', async () => {
      expect((await attempt({ arrivalAirport: 'HND' })).status).toBe(400);
    });

    it('compares arrival and departure in UTC, not in local time', async () => {
      // HND 10:00 (UTC+9) = 01:00 UTC. DXB 04:30 (UTC+4) = 00:30 UTC: before the departure.
      const before = await attempt({ arrivalLocal: `${day(60)}T04:30` });
      expect(before.status).toBe(400);
      // DXB 05:00 = 01:00 UTC: the same moment as the departure, so not after it.
      const same = await attempt({ arrivalLocal: `${day(60)}T05:00` });
      expect(same.status).toBe(400);
      // DXB 06:00 = 02:00 UTC: after the departure although the local clock shows an earlier
      // time than the 10:00 departure.
      const after = await attempt({ arrivalLocal: `${day(60)}T06:00` });
      expect(after.status).toBe(201);
      expect(after.body.durationMinutes).toBe(60);
    });

    it('rejects a departure in the past', async () => {
      const res = await attempt({
        flightNumber: `${airline.code}778`,
        departureLocal: `${day(-1)}T10:00`,
        arrivalLocal: `${day(-1)}T16:00`,
      });
      expect(res.status).toBe(400);
    });

    it('rejects a duplicate flight number of the same airline on the same departure date', async () => {
      const first = await createFlight(airline, { inDays: 61 });
      const again = await airline.moderator.client.post('/api/flights', {
        flightNumber: first.flightNumber,
        departureAirport: 'DXB',
        arrivalAirport: 'RUH',
        departureLocal: `${day(61)}T18:00`,
        arrivalLocal: `${day(61)}T19:30`,
      });
      expect(again.status).toBe(409);
      // The same number on another date is fine, and so is the same number for another airline.
      const otherDay = await airline.moderator.client.post('/api/flights', {
        flightNumber: first.flightNumber,
        departureAirport: 'DXB',
        arrivalAirport: 'RUH',
        departureLocal: `${day(62)}T18:00`,
        arrivalLocal: `${day(62)}T19:30`,
      });
      expect(otherDay.status).toBe(201);
    });

    it('only an airline moderator creates flights', async () => {
      const body = {
        flightNumber: 'AB123',
        departureAirport: 'DXB',
        arrivalAirport: 'RUH',
        departureLocal: `${day(30)}T10:00`,
        arrivalLocal: `${day(30)}T11:00`,
      };
      expect((await t.guest().post('/api/flights', body)).status).toBe(401);
      expect((await (await t.admin()).post('/api/flights', body)).status).toBe(
        403,
      );
      const user = await t.user();
      expect((await user.client.post('/api/flights', body)).status).toBe(403);
    });
  });

  describe('FLT-04 cabin categories (Mandatory row 20)', () => {
    it('defines each category of the fixed set at most once per flight', async () => {
      const flight = await createFlight(airline, { inDays: 63 });
      for (const cabinClass of [
        'economy',
        'premium_economy',
        'business',
        'first',
      ]) {
        const res = await airline.moderator.client.post(
          `/api/flights/${flight.id}/cabins`,
          {
            cabinClass,
            seats: 10,
            price: 15000,
            freeBags: 1,
            maxBagWeightKg: 23,
          },
        );
        expect(res.status).toBe(201);
      }
      const twice = await airline.moderator.client.post(
        `/api/flights/${flight.id}/cabins`,
        {
          cabinClass: 'economy',
          seats: 5,
          price: 100,
          freeBags: 0,
          maxBagWeightKg: 10,
        },
      );
      expect(twice.status).toBe(409);
      const details = await t.guest().get(`/api/flights/${flight.id}`);
      expect(details.body.cabins).toHaveLength(4);
    });

    it.each([
      ['a category outside the fixed set', { cabinClass: 'luxury' }],
      ['zero seats', { seats: 0 }],
      ['a seat count that is not a whole number', { seats: 2.5 }],
      ['a price of zero', { price: 0 }],
      ['a negative price', { price: -1 }],
    ])('rejects %s', async (_case, overrides) => {
      const flight = await createFlight(airline, { inDays: 64 });
      const res = await airline.moderator.client.post(
        `/api/flights/${flight.id}/cabins`,
        {
          cabinClass: 'economy',
          seats: 10,
          price: 15000,
          freeBags: 1,
          maxBagWeightKg: 23,
          ...overrides,
        },
      );
      expect(res.status).toBe(400);
    });

    it('another airline cannot add a cabin to this flight', async () => {
      const flight = await createFlight(airline, { inDays: 65 });
      const other = await airlineWithModerator(t);
      const res = await other.moderator.client.post(
        `/api/flights/${flight.id}/cabins`,
        {
          cabinClass: 'economy',
          seats: 10,
          price: 15000,
          freeBags: 1,
          maxBagWeightKg: 23,
        },
      );
      expect(res.status).toBe(403);
    });
  });

  describe('FLT-05 edit a flight (Mandatory row 21)', () => {
    it('edits the times, cabin price and cabin seat count of an own scheduled flight', async () => {
      const flight = await createFlight(airline, { inDays: 66 });
      const withCabin = await addCabin(airline, flight.id, {
        seats: 10,
        price: 20000,
      });
      const times = await airline.moderator.client.patch(
        `/api/flights/${flight.id}`,
        {
          departureLocal: `${day(66)}T12:00`,
          arrivalLocal: `${day(66)}T13:30`,
        },
      );
      expect(times.status).toBe(200);
      expect(times.body.departureAt).toBe(`${day(66)}T08:00:00.000Z`);
      expect(times.body.durationMinutes).toBe(150);
      const cabinId = withCabin.cabins[0].id as string;
      const cabin = await airline.moderator.client.patch(
        `/api/flights/${flight.id}/cabins/${cabinId}`,
        { price: 25000, seats: 12 },
      );
      expect(cabin.status).toBe(200);
      const details = await t.guest().get(`/api/flights/${flight.id}`);
      expect(details.body.cabins[0]).toMatchObject({
        price: 25000,
        seatsRemaining: 12,
      });
      const other = await airlineWithModerator(t);
      const foreign = await other.moderator.client.patch(
        `/api/flights/${flight.id}`,
        { departureLocal: `${day(66)}T13:00` },
      );
      expect(foreign.status).toBe(403);
    });

    it('a flight that is not Scheduled cannot be edited (FLT-30)', async () => {
      const flight = await bookableFlight(airline, { inDays: 67 });
      const cancelled = await airline.moderator.client.post(
        `/api/flights/${flight.id}/cancel`,
      );
      expect(cancelled.status).toBe(200);
      const res = await airline.moderator.client.patch(
        `/api/flights/${flight.id}`,
        {
          departureLocal: `${day(67)}T12:00`,
          arrivalLocal: `${day(67)}T13:30`,
        },
      );
      expect(res.status).toBe(409);
    });
  });

  describe('FLT-11 search (Mandatory row 25)', () => {
    it('lists the scheduled flights of that local departure date with enough seats', async () => {
      const morning = await bookableFlight(
        airline,
        { inDays: 70, departureTime: '08:00', arrivalTime: '09:00' },
        { seats: 3, price: 30000 },
      );
      const evening = await bookableFlight(
        airline,
        { inDays: 70, departureTime: '20:00', arrivalTime: '21:00' },
        { seats: 1, price: 10000 },
      );
      const nextDay = await bookableFlight(airline, { inDays: 71 });
      const res = await search({
        origin: 'DXB',
        destination: 'RUH',
        departureDate: day(70),
        adults: 2,
      });
      expect(res.status).toBe(200);
      const ids = (res.body.items as any[]).map((f) => f.id);
      expect(ids).toContain(morning.id);
      // Only 1 seat left on the evening flight: not enough for 2 passengers.
      expect(ids).not.toContain(evening.id);
      expect(ids).not.toContain(nextDay.id);
      const found = (res.body.items as any[]).find((f) => f.id === morning.id);
      expect(found.flightNumber).toBe(morning.flightNumber);
      expect(found.departureLocal).toBe(`${day(70)}T08:00`);
      expect(found.cabins[0]).toMatchObject({
        cabinClass: 'economy',
        price: 30000,
        availableSeats: 3,
      });
      // One passenger: both flights of the day.
      const single = await search({
        origin: 'DXB',
        destination: 'RUH',
        departureDate: day(70),
      });
      expect((single.body.items as any[]).map((f) => f.id)).toEqual(
        expect.arrayContaining([morning.id, evening.id]),
      );
    });

    it('uses the local date at the departure airport', async () => {
      // HND 01:00 local on day 72 is 16:00 UTC on day 71.
      const flight = await bookableFlight(airline, {
        from: 'HND',
        to: 'DXB',
        inDays: 72,
        departureTime: '01:00',
        arrivalTime: '08:00',
      });
      const onLocalDate = await search({
        origin: 'HND',
        destination: 'DXB',
        departureDate: day(72),
      });
      expect((onLocalDate.body.items as any[]).map((f) => f.id)).toContain(
        flight.id,
      );
      const onUtcDate = await search({
        origin: 'HND',
        destination: 'DXB',
        departureDate: day(71),
      });
      expect((onUtcDate.body.items as any[]).map((f) => f.id)).not.toContain(
        flight.id,
      );
    });

    it('says "no flights found" when nothing matches', async () => {
      const res = await search({
        origin: 'JFK',
        destination: 'CDG',
        departureDate: day(73),
      });
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.total).toBe(0);
      expect(res.body.message).toMatch(/no flights found/i);
    });

    it('hides cancelled and departed flights and flights of a deactivated airline (FLT-30, ACC-15)', async () => {
      const mine = await airlineWithModerator(t);
      const cancelled = await bookableFlight(mine, {
        from: 'LHR',
        to: 'CDG',
        inDays: 74,
        departureTime: '08:00',
        arrivalTime: '10:30',
      });
      const departed = await bookableFlight(mine, {
        from: 'LHR',
        to: 'CDG',
        inDays: 74,
        departureTime: '12:00',
        arrivalTime: '14:30',
      });
      const open = await bookableFlight(mine, {
        from: 'LHR',
        to: 'CDG',
        inDays: 74,
        departureTime: '15:00',
        arrivalTime: '17:30',
      });
      await mine.moderator.client.post(`/api/flights/${cancelled.id}/cancel`);
      // The departure time passes; the scheduled job then marks the flight Departed.
      await t
        .collection('flights')
        .updateOne(
          { _id: t.oid(departed.id) },
          { $set: { departureAt: new Date(Date.now() - 60_000) } },
        );
      const query = {
        origin: 'LHR',
        destination: 'CDG',
        departureDate: day(74),
      };
      // Not searchable from the moment the departure time has passed, even before the job ran.
      let ids = ((await search(query)).body.items as any[]).map((f) => f.id);
      expect(ids).toEqual([open.id]);
      await t.service(FlightStatusJob).markDeparted();
      const stored = await t
        .collection('flights')
        .findOne({ _id: t.oid(departed.id) });
      expect(stored!.status).toBe('departed');
      const details = await t.guest().get(`/api/flights/${departed.id}`);
      expect(details.body.status).toBe('departed');
      // A departed flight cannot be edited or cancelled.
      expect(
        (await mine.moderator.client.post(`/api/flights/${departed.id}/cancel`))
          .status,
      ).toBe(409);
      // Deactivating the airline hides its flights; reactivating shows them again.
      const admin = await t.admin();
      expect(
        (
          await admin.patch(
            `/api/admin/providers/airline/${mine.airlineId}/deactivate`,
            {},
          )
        ).status,
      ).toBe(200);
      ids = ((await search(query)).body.items as any[]).map((f) => f.id);
      expect(ids).toEqual([]);
      expect((await t.guest().get(`/api/flights/${open.id}`)).status).toBe(404);
      expect(
        (
          await admin.patch(
            `/api/admin/providers/airline/${mine.airlineId}/reactivate`,
            {},
          )
        ).status,
      ).toBe(200);
      ids = ((await search(query)).body.items as any[]).map((f) => f.id);
      expect(ids).toEqual([open.id]);
    });

    it('guests can search; required fields are validated', async () => {
      expect((await search({ origin: 'DXB', destination: 'RUH' })).status).toBe(
        400,
      );
      expect(
        (
          await search({
            origin: 'DXB',
            destination: 'DXB',
            departureDate: day(70),
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await search({
            origin: 'DXB',
            destination: 'RUH',
            departureDate: 'tomorrow',
          })
        ).status,
      ).toBe(400);
    });
  });

  describe('FLT-12 round trip, passenger types, cabin filter (Mandatory row 26)', () => {
    it('a round-trip search returns outbound and return options', async () => {
      const mine = await airlineWithModerator(t);
      const out = await bookableFlight(mine, {
        from: 'CAI',
        to: 'LHR',
        inDays: 80,
        departureTime: '09:00',
        arrivalTime: '13:00',
      });
      const back = await bookableFlight(mine, {
        from: 'LHR',
        to: 'CAI',
        inDays: 87,
        departureTime: '15:00',
        arrivalTime: '22:00',
      });
      const res = await search({
        origin: 'CAI',
        destination: 'LHR',
        departureDate: day(80),
        returnDate: day(87),
        tripType: 'round_trip',
      });
      expect(res.status).toBe(200);
      expect((res.body.outbound.items as any[]).map((f) => f.id)).toEqual([
        out.id,
      ]);
      expect((res.body.return.items as any[]).map((f) => f.id)).toEqual([
        back.id,
      ]);
      const noReturnDate = await search({
        origin: 'CAI',
        destination: 'LHR',
        departureDate: day(80),
        tripType: 'round_trip',
      });
      expect(noReturnDate.status).toBe(400);
    });

    it('adults and children pay the fare and take a seat; infants pay 10% and take no seat', async () => {
      const mine = await airlineWithModerator(t);
      const flight = await bookableFlight(
        mine,
        {
          from: 'CDG',
          to: 'JFK',
          inDays: 81,
          departureTime: '10:00',
          arrivalTime: '13:00',
        },
        { seats: 3, price: 19999 },
      );
      const res = await search({
        origin: 'CDG',
        destination: 'JFK',
        departureDate: day(81),
        adults: 2,
        children: 1,
        infants: 2,
      });
      const found = (res.body.items as any[]).find((f) => f.id === flight.id);
      // 3 seats are enough for 2 adults + 1 child; the 2 infants need none.
      expect(found).toBeDefined();
      expect(res.body.seatsRequired).toBe(3);
      // 2 x 19999 + 1 x 19999 + 2 x 10% of 19999 (1999.9 -> 2000 cents each)
      expect(found.cabins[0].totalPrice).toBe(3 * 19999 + 2 * 2000);
      const fourSeats = await search({
        origin: 'CDG',
        destination: 'JFK',
        departureDate: day(81),
        adults: 2,
        children: 2,
      });
      expect((fourSeats.body.items as any[]).map((f) => f.id)).not.toContain(
        flight.id,
      );
    });

    it('needs at least one adult and no more infants than adults', async () => {
      const base = {
        origin: 'DXB',
        destination: 'RUH',
        departureDate: day(70),
      };
      expect((await search({ ...base, adults: 0, children: 1 })).status).toBe(
        400,
      );
      expect((await search({ ...base, adults: 1, infants: 2 })).status).toBe(
        400,
      );
      expect((await search({ ...base, adults: 2, infants: 2 })).status).toBe(
        200,
      );
    });

    it('the optional cabin-class filter keeps only that cabin', async () => {
      const mine = await airlineWithModerator(t);
      const both = await createFlight(mine, {
        from: 'RUH',
        to: 'CAI',
        inDays: 82,
      });
      await addCabin(mine, both.id, { cabinClass: 'economy', price: 10000 });
      await addCabin(mine, both.id, { cabinClass: 'business', price: 50000 });
      const economyOnly = await bookableFlight(mine, {
        from: 'RUH',
        to: 'CAI',
        inDays: 82,
        departureTime: '15:00',
        arrivalTime: '16:00',
      });
      const base = {
        origin: 'RUH',
        destination: 'CAI',
        departureDate: day(82),
      };
      const business = await search({ ...base, cabinClass: 'business' });
      expect((business.body.items as any[]).map((f) => f.id)).toEqual([
        both.id,
      ]);
      expect(
        (business.body.items[0].cabins as any[]).map((c) => c.cabinClass),
      ).toEqual(['business']);
      const all = await search(base);
      expect((all.body.items as any[]).map((f) => f.id).sort()).toEqual(
        [both.id, economyOnly.id].sort(),
      );
      expect((await search({ ...base, cabinClass: 'luxury' })).status).toBe(
        400,
      );
    });
  });

  describe('FLT-15 price filter and sorting (Mandatory row 27)', () => {
    let cheapLong: { id: string };
    let midShort: { id: string };
    let dearMid: { id: string };
    const base = () => ({
      origin: 'FRA',
      destination: 'HND',
      departureDate: day(83),
    });
    beforeAll(async () => {
      const mine = await airlineWithModerator(t);
      // FRA is UTC+1 in winter / UTC+2 in summer; only the order of the three flights matters.
      cheapLong = await bookableFlight(
        mine,
        {
          from: 'FRA',
          to: 'HND',
          inDays: 83,
          departureTime: '18:00',
          arrivalTime: '20:00',
          arrivalDayOffset: 1,
        },
        { price: 10000 },
      );
      midShort = await bookableFlight(
        mine,
        {
          from: 'FRA',
          to: 'HND',
          inDays: 83,
          departureTime: '06:00',
          arrivalTime: '23:00',
        },
        { price: 20000 },
      );
      dearMid = await bookableFlight(
        mine,
        {
          from: 'FRA',
          to: 'HND',
          inDays: 83,
          departureTime: '12:00',
          arrivalTime: '10:00',
          arrivalDayOffset: 1,
        },
        { price: 30000 },
      );
    });
    const ids = async (query: Record<string, string | number>) =>
      ((await search({ ...base(), ...query })).body.items as any[]).map(
        (f) => f.id,
      );

    it('filters by an inclusive minimum and maximum price, keeping the other criteria', async () => {
      expect((await ids({ minPrice: 20000, maxPrice: 30000 })).sort()).toEqual(
        [midShort.id, dearMid.id].sort(),
      );
      expect(await ids({ minPrice: 10000, maxPrice: 10000 })).toEqual([
        cheapLong.id,
      ]);
      expect(await ids({ minPrice: 30001 })).toEqual([]);
      expect(await ids({ maxPrice: 9999 })).toEqual([]);
    });

    it('answers an error when min is greater than max', async () => {
      const res = await search({ ...base(), minPrice: 300, maxPrice: 200 });
      expect(res.status).toBe(400);
    });

    it('sorts by price, by duration and by departure time', async () => {
      expect(await ids({ sortBy: 'price' })).toEqual([
        cheapLong.id,
        midShort.id,
        dearMid.id,
      ]);
      expect(await ids({ sortBy: 'price', sortOrder: 'desc' })).toEqual([
        dearMid.id,
        midShort.id,
        cheapLong.id,
      ]);
      expect(await ids({ sortBy: 'duration' })).toEqual([
        midShort.id,
        dearMid.id,
        cheapLong.id,
      ]);
      expect(await ids({ sortBy: 'departure_time' })).toEqual([
        midShort.id,
        dearMid.id,
        cheapLong.id,
      ]);
      expect(
        await ids({ sortBy: 'departure_time', sortOrder: 'desc' }),
      ).toEqual([cheapLong.id, dearMid.id, midShort.id]);
    });
  });

  describe('FLT-17 flight details (Mandatory row 28), FLT-08, FLT-09 policies', () => {
    it('shows airline, number, airports, local times, duration, cabins and the cancellation policy', async () => {
      const mine = await airlineWithModerator(t);
      const tiers = await mine.moderator.client.put(
        `/api/airlines/${mine.airlineId}/cancellation-policy`,
        {
          tiers: [
            { daysBefore: 7, refundPercentage: 50 },
            { daysBefore: 30, refundPercentage: 100 },
          ],
        },
      );
      expect(tiers.status).toBe(200);
      const bags = await mine.moderator.client.put(
        `/api/airlines/${mine.airlineId}/baggage-policy`,
        { extraBagPrice: 3000, maxExtraBagsPerPassenger: 2 },
      );
      expect(bags.status).toBe(200);
      const flight = await createFlight(mine, {
        from: 'DXB',
        to: 'HND',
        inDays: 84,
        departureTime: '10:00',
        arrivalTime: '23:00',
      });
      await addCabin(mine, flight.id, {
        cabinClass: 'business',
        seats: 4,
        price: 90000,
        freeBags: 2,
        maxBagWeightKg: 32,
      });
      await addCabin(mine, flight.id, {
        cabinClass: 'economy',
        seats: 100,
        price: 40000,
        freeBags: 1,
        maxBagWeightKg: 23,
      });

      const res = await t.guest().get(`/api/flights/${flight.id}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        flightNumber: flight.flightNumber,
        airline: { id: mine.airlineId, code: mine.code },
        departureAirport: { iataCode: 'DXB', timeZone: 'Asia/Dubai' },
        arrivalAirport: { iataCode: 'HND', timeZone: 'Asia/Tokyo' },
        departureLocal: `${day(84)}T10:00`,
        arrivalLocal: `${day(84)}T23:00`,
        durationMinutes: 480,
        currency: 'USD',
      });
      const economy = (res.body.cabins as any[]).find(
        (c) => c.cabinClass === 'economy',
      );
      expect(economy).toMatchObject({
        price: 40000,
        seatsRemaining: 100,
        freeBags: 1,
        maxBagWeightKg: 23,
      });
      const business = (res.body.cabins as any[]).find(
        (c) => c.cabinClass === 'business',
      );
      expect(business).toMatchObject({
        price: 90000,
        seatsRemaining: 4,
        freeBags: 2,
        maxBagWeightKg: 32,
      });
      expect(
        (res.body.cancellationPolicy.tiers as any[]).map((x) => [
          x.daysBefore,
          x.refundPercentage,
        ]),
      ).toEqual(
        expect.arrayContaining([
          [30, 100],
          [7, 50],
        ]),
      );
      expect(res.body.cancellationPolicy.tiers).toHaveLength(2);
      expect(
        (await t.guest().get('/api/flights/000000000000000000000000')).status,
      ).toBe(404);
    });

    it('FLT-08: extra bag price must be > 0 and the maximum per passenger >= 0', async () => {
      const mine = await airlineWithModerator(t);
      const put = (body: unknown) =>
        mine.moderator.client.put(
          `/api/airlines/${mine.airlineId}/baggage-policy`,
          body,
        );
      expect(
        (await put({ extraBagPrice: 0, maxExtraBagsPerPassenger: 1 })).status,
      ).toBe(400);
      expect(
        (await put({ extraBagPrice: 100, maxExtraBagsPerPassenger: -1 }))
          .status,
      ).toBe(400);
      expect(
        (await put({ extraBagPrice: 1, maxExtraBagsPerPassenger: 0 })).status,
      ).toBe(200);
      const foreign = await airline.moderator.client.put(
        `/api/airlines/${mine.airlineId}/baggage-policy`,
        { extraBagPrice: 100, maxExtraBagsPerPassenger: 1 },
      );
      expect(foreign.status).toBe(403);
    });

    it('FLT-09: thresholds are unique whole numbers >= 0 and percentages are 0-100', async () => {
      const mine = await airlineWithModerator(t);
      const put = (tiers: unknown) =>
        mine.moderator.client.put(
          `/api/airlines/${mine.airlineId}/cancellation-policy`,
          { tiers },
        );
      expect(
        (
          await put([
            { daysBefore: 7, refundPercentage: 50 },
            { daysBefore: 7, refundPercentage: 80 },
          ])
        ).status,
      ).toBe(400);
      expect(
        (await put([{ daysBefore: -1, refundPercentage: 50 }])).status,
      ).toBe(400);
      expect(
        (await put([{ daysBefore: 1.5, refundPercentage: 50 }])).status,
      ).toBe(400);
      expect(
        (await put([{ daysBefore: 1, refundPercentage: 101 }])).status,
      ).toBe(400);
      expect(
        (await put([{ daysBefore: 1, refundPercentage: -1 }])).status,
      ).toBe(400);
      expect(
        (
          await put([
            { daysBefore: 0, refundPercentage: 0 },
            { daysBefore: 3, refundPercentage: 100 },
          ])
        ).status,
      ).toBe(200);
    });

    it('FLT-08, FLT-09: policy updates sent at the same moment never fail with a server error', async () => {
      const mine = await airlineWithModerator(t);
      const percentages = [10, 20, 30, 40, 50];
      const tiers = await Promise.all(
        percentages.map((refundPercentage) =>
          mine.moderator.client.put(
            `/api/airlines/${mine.airlineId}/cancellation-policy`,
            { tiers: [{ daysBefore: 5, refundPercentage }] },
          ),
        ),
      );
      expect(tiers.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
      const bags = await Promise.all(
        [1, 2, 3, 4, 5].map((max) =>
          mine.moderator.client.put(
            `/api/airlines/${mine.airlineId}/baggage-policy`,
            { extraBagPrice: 1000 * max, maxExtraBagsPerPassenger: max },
          ),
        ),
      );
      expect(bags.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
      // The stored policy is exactly one of the policies that were sent, never a mix.
      const shown = await t.guest().get(`/api/airlines/${mine.airlineId}`);
      expect(shown.body.cancellationTiers).toHaveLength(1);
      expect(percentages).toContain(
        shown.body.cancellationTiers[0].refundPercentage,
      );
      const { extraBagPrice, maxExtraBagsPerPassenger } =
        shown.body.baggagePolicy;
      expect(extraBagPrice).toBe(1000 * maxExtraBagsPerPassenger);
    });
  });
});
