// System tests: itineraries, days, activities, budgets, currency conversion (real FXRatesAPI),
// visibility, public search and cloning, and the hotel / flight searches of an itinerary.
// Expected results come from the Excel sheet "Mandatory" (row in brackets) and the project
// description sections 6.5 and 8.8.
import { Account, PNG, TestApp, day, unique } from '../support/harness';
import {
  addRoom,
  airlineWithModerator,
  bookableFlight,
  hotelWithModerator,
} from '../support/scenarios';

describe('Itineraries', () => {
  const t = new TestApp();
  let user: Account;
  let other: Account;
  beforeAll(async () => {
    await t.start();
    user = await t.user('Itinerary Owner');
    other = await t.user('Another Traveller');
  });
  afterAll(() => t.stop());

  const create = async (
    account: Account,
    overrides: Record<string, unknown> = {},
  ) => {
    const res = await account.client.post('/api/itineraries', {
      title: `Trip ${unique('t')}`,
      countryCodes: ['EG'],
      startDate: day(30),
      ...overrides,
    });
    if (res.status !== 201) throw new Error(res.text);
    return res.body as { id: string; title: string; [key: string]: any };
  };
  const addDay = async (account: Account, id: string, cityId: string) => {
    const res = await account.client.post(`/api/itineraries/${id}/days`, {
      cityId,
    });
    if (res.status !== 201) throw new Error(res.text);
    return res.body as { id: string; number: number; date: string };
  };
  const get = async (account: Account, id: string) =>
    (await account.client.get(`/api/itineraries/${id}`)).body;
  const publish = (account: Account, id: string) =>
    account.client.patch(`/api/itineraries/${id}`, { visibility: 'public' });

  describe('ITN-01 create, edit, delete (Mandatory row 59), ITN-03 list (row 60)', () => {
    it('creates a private itinerary with a title, countries from the list and a start date', async () => {
      const res = await user.client.post('/api/itineraries', {
        title: 'Egypt and Emirates',
        countryCodes: ['EG', 'AE'],
        startDate: day(30),
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        title: 'Egypt and Emirates',
        countryCodes: ['EG', 'AE'],
        startDate: day(30),
        visibility: 'private',
        days: [],
      });
    });

    it.each([
      ['a missing title', { title: '' }],
      ['a title longer than 100 characters', { title: 'x'.repeat(101) }],
      ['no country', { countryCodes: [] }],
      ['a country that is not in the list', { countryCodes: ['EG', 'ZZ'] }],
      ['a start date that is not a date', { startDate: 'soon' }],
      ['a start date with a time', { startDate: `${day(30)}T10:00:00Z` }],
    ])('rejects %s', async (_case, overrides) => {
      const res = await user.client.post('/api/itineraries', {
        title: 'Valid',
        countryCodes: ['EG'],
        startDate: day(30),
        ...overrides,
      });
      expect(res.status).toBe(400);
    });

    it('accepts a title of exactly 100 characters; guests cannot create', async () => {
      const ok = await user.client.post('/api/itineraries', {
        title: 'x'.repeat(100),
        countryCodes: ['EG'],
        startDate: day(30),
      });
      expect(ok.status).toBe(201);
      expect(
        (
          await t.guest().post('/api/itineraries', {
            title: 'x',
            countryCodes: ['EG'],
            startDate: day(30),
          })
        ).status,
      ).toBe(401);
    });

    it('edits title, countries and start date; the days follow the new start date', async () => {
      const trip = await create(user);
      await addDay(user, trip.id, 'cairo');
      await addDay(user, trip.id, 'cairo');
      const res = await user.client.patch(`/api/itineraries/${trip.id}`, {
        title: 'Renamed',
        countryCodes: ['FR', 'DE'],
        startDate: day(50),
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        title: 'Renamed',
        countryCodes: ['FR', 'DE'],
        startDate: day(50),
      });
      expect((res.body.days as any[]).map((d) => [d.number, d.date])).toEqual([
        [1, day(50)],
        [2, day(51)],
      ]);
      expect(
        (
          await user.client.patch(`/api/itineraries/${trip.id}`, {
            countryCodes: ['XX'],
          })
        ).status,
      ).toBe(400);
    });

    it('ACC-11: a private itinerary is accessible to its owner only', async () => {
      const trip = await create(user);
      const day1 = await addDay(user, trip.id, 'cairo');
      expect(
        (await other.client.get(`/api/itineraries/${trip.id}`)).status,
      ).toBe(404);
      expect(
        (
          await other.client.patch(`/api/itineraries/${trip.id}`, {
            title: 'Stolen',
          })
        ).status,
      ).toBe(404);
      expect(
        (await other.client.delete(`/api/itineraries/${trip.id}`)).status,
      ).toBe(404);
      expect(
        (
          await other.client.post(`/api/itineraries/${trip.id}/days`, {
            cityId: 'cairo',
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await other.client.delete(
            `/api/itineraries/${trip.id}/days/${day1.id}`,
            { query: { confirm: true } },
          )
        ).status,
      ).toBe(404);
      expect(
        (await other.client.get(`/api/itineraries/${trip.id}/budget-summary`))
          .status,
      ).toBe(404);
      expect(
        (await other.client.post(`/api/itineraries/${trip.id}/clone`)).status,
      ).toBe(404);
      expect(
        (await t.guest().get(`/api/itineraries/public/${trip.id}`)).status,
      ).toBe(404);
      expect((await t.guest().get(`/api/itineraries/${trip.id}`)).status).toBe(
        401,
      );
      // Not even an admin reads a private itinerary.
      expect(
        (await (await t.admin()).get(`/api/itineraries/${trip.id}`)).status,
      ).toBe(403);
      expect((await get(user, trip.id)).title).toBe(trip.title);
    });

    it('ITN-03: lists own itineraries with title, countries, start date, days and visibility, most recently updated first', async () => {
      const owner = await t.user();
      const first = await create(owner, { title: 'First' });
      const second = await create(owner, {
        title: 'Second',
        countryCodes: ['JP'],
      });
      await addDay(owner, second.id, 'tokyo');
      let list = await owner.client.get('/api/itineraries');
      expect(list.status).toBe(200);
      expect((list.body.items as any[]).map((i) => i.title)).toEqual([
        'Second',
        'First',
      ]);
      expect(list.body.items[0]).toMatchObject({
        id: second.id,
        countryCodes: ['JP'],
        startDate: day(30),
        numberOfDays: 1,
        visibility: 'private',
      });
      // Updating the first one moves it to the top.
      await owner.client.patch(`/api/itineraries/${first.id}`, {
        title: 'First again',
      });
      list = await owner.client.get('/api/itineraries');
      expect((list.body.items as any[]).map((i) => i.title)).toEqual([
        'First again',
        'Second',
      ]);
      expect((await t.guest().get('/api/itineraries')).status).toBe(401);
    });

    it('GEN-05: lists longer than 10 rows are paginated with page size 10', async () => {
      const owner = await t.user();
      for (let i = 0; i < 11; i++) await create(owner);
      const page1 = await owner.client.get('/api/itineraries');
      expect(page1.body).toMatchObject({
        page: 1,
        pageSize: 10,
        total: 11,
        totalPages: 2,
      });
      expect(page1.body.items).toHaveLength(10);
      const page2 = await owner.client.get('/api/itineraries', {
        query: { page: 2 },
      });
      expect(page2.body.items).toHaveLength(1);
      // GEN-04: an empty list is an empty page, not an error.
      const page3 = await owner.client.get('/api/itineraries', {
        query: { page: 3 },
      });
      expect(page3.status).toBe(200);
      expect(page3.body.items).toEqual([]);
      expect(
        (await owner.client.get('/api/itineraries', { query: { page: 0 } }))
          .status,
      ).toBe(400);
    });
  });

  describe('ITN-05 days (row 61), ITN-07 delete (row 62), ITN-08 move (row 63), ITN-09 groups (row 64)', () => {
    it('days are numbered sequentially and dated from the start date; the city comes from the list', async () => {
      const trip = await create(user);
      const d1 = await addDay(user, trip.id, 'cairo');
      const d2 = await addDay(user, trip.id, 'dubai');
      expect([d1.number, d1.date, d2.number, d2.date]).toEqual([
        1,
        day(30),
        2,
        day(31),
      ]);
      // ITN-09: every day needs a city from the predefined list.
      expect(
        (await user.client.post(`/api/itineraries/${trip.id}/days`, {})).status,
      ).toBe(400);
      expect(
        (
          await user.client.post(`/api/itineraries/${trip.id}/days`, {
            cityId: 'atlantis',
          })
        ).status,
      ).toBe(400);
      const edited = await user.client.patch(
        `/api/itineraries/${trip.id}/days/${d2.id}`,
        { cityId: 'paris', notes: 'Museum day' },
      );
      expect(edited.status).toBe(200);
      expect(edited.body).toMatchObject({
        cityId: 'paris',
        notes: 'Museum day',
        number: 2,
        date: day(31),
      });
      expect(
        (
          await user.client.patch(`/api/itineraries/${trip.id}/days/${d2.id}`, {
            cityId: 'nowhere',
          })
        ).status,
      ).toBe(400);
    });

    it('an itinerary has at most 60 days', async () => {
      const trip = await create(user);
      for (let i = 0; i < 60; i++) await addDay(user, trip.id, 'cairo');
      const res = await user.client.post(`/api/itineraries/${trip.id}/days`, {
        cityId: 'cairo',
      });
      expect(res.status).toBe(409);
      const full = await get(user, trip.id);
      expect(full.days).toHaveLength(60);
      expect(full.days[59]).toMatchObject({ number: 60, date: day(89) });
    });

    it('adding days at the same moment keeps the numbering sequential and never passes 60', async () => {
      const trip = await create(user);
      for (let i = 0; i < 57; i++) await addDay(user, trip.id, 'cairo');
      const results = await Promise.all(
        Array.from({ length: 6 }, () =>
          user.client.post(`/api/itineraries/${trip.id}/days`, {
            cityId: 'dubai',
          }),
        ),
      );
      expect(results.map((r) => r.status).filter((s) => s >= 500)).toEqual([]);
      const full = await get(user, trip.id);
      expect(full.days.length).toBeLessThanOrEqual(60);
      expect((full.days as any[]).map((d) => d.number)).toEqual(
        Array.from({ length: full.days.length }, (_, i) => i + 1),
      );
    });

    it('consecutive days in the same city form a group with its day count; deleting and moving days recalculates everything', async () => {
      const trip = await create(user);
      const cities = ['cairo', 'cairo', 'dubai', 'cairo', 'cairo'];
      const days = [];
      for (const city of cities) days.push(await addDay(user, trip.id, city));
      let full = await get(user, trip.id);
      expect(
        (full.cityGroups as any[]).map((g) => [
          g.cityId,
          g.dayCount,
          g.firstDay,
          g.lastDay,
          g.startDate,
          g.endDate,
        ]),
      ).toEqual([
        ['cairo', 2, 1, 2, day(30), day(31)],
        ['dubai', 1, 3, 3, day(32), day(32)],
        ['cairo', 2, 4, 5, day(33), day(34)],
      ]);

      // ITN-07: delete the Dubai day after confirmation -> one Cairo group of 4 days.
      expect(
        (
          await user.client.delete(
            `/api/itineraries/${trip.id}/days/${days[2].id}`,
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await user.client.delete(
            `/api/itineraries/${trip.id}/days/${days[2].id}`,
            { query: { confirm: false } },
          )
        ).status,
      ).toBe(400);
      expect((await get(user, trip.id)).days).toHaveLength(5);
      expect(
        (
          await user.client.delete(
            `/api/itineraries/${trip.id}/days/${days[2].id}`,
            { query: { confirm: true } },
          )
        ).status,
      ).toBe(204);
      full = await get(user, trip.id);
      expect((full.days as any[]).map((d) => [d.id, d.number, d.date])).toEqual(
        [
          [days[0].id, 1, day(30)],
          [days[1].id, 2, day(31)],
          [days[3].id, 3, day(32)],
          [days[4].id, 4, day(33)],
        ],
      );
      expect(
        (full.cityGroups as any[]).map((g) => [g.cityId, g.dayCount]),
      ).toEqual([['cairo', 4]]);

      // ITN-08: move day 4 to position 1.
      const moved = await user.client.patch(
        `/api/itineraries/${trip.id}/days/reorder`,
        { dayId: days[4].id, position: 1 },
      );
      expect(moved.status).toBe(200);
      expect(
        (moved.body.days as any[]).map((d) => [d.id, d.number, d.date]),
      ).toEqual([
        [days[4].id, 1, day(30)],
        [days[0].id, 2, day(31)],
        [days[1].id, 3, day(32)],
        [days[3].id, 4, day(33)],
      ]);
      expect(
        (
          await user.client.patch(`/api/itineraries/${trip.id}/days/reorder`, {
            dayId: days[4].id,
            position: 5,
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await user.client.patch(`/api/itineraries/${trip.id}/days/reorder`, {
            dayId: days[4].id,
            position: 0,
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await user.client.patch(`/api/itineraries/${trip.id}/days/reorder`, {
            dayId: days[2].id,
            position: 1,
          })
        ).status,
      ).toBe(404);
    });

    it('ITN-08: moving a day between cities changes the groups', async () => {
      const trip = await create(user);
      const a = await addDay(user, trip.id, 'cairo');
      await addDay(user, trip.id, 'dubai');
      await addDay(user, trip.id, 'cairo');
      const moved = await user.client.patch(
        `/api/itineraries/${trip.id}/days/reorder`,
        { dayId: a.id, position: 3 },
      );
      expect(
        (moved.body.cityGroups as any[]).map((g) => [
          g.cityId,
          g.dayCount,
          g.startDate,
        ]),
      ).toEqual([
        ['dubai', 1, day(30)],
        ['cairo', 2, day(31)],
      ]);
    });
  });

  describe('ITN-10 activities (row 65), ITN-12 images (row 66), GEN-08', () => {
    it('adds, edits and deletes activities with name, description, optional time and optional cost', async () => {
      const trip = await create(user);
      const d = await addDay(user, trip.id, 'cairo');
      const path = `/api/itineraries/${trip.id}/days/${d.id}/activities`;
      const plain = await user.client.post(path, {
        name: 'Walk',
        description: 'Along the Nile',
      });
      expect(plain.status).toBe(201);
      expect(plain.body).toMatchObject({
        name: 'Walk',
        description: 'Along the Nile',
      });
      expect(plain.body.time).toBeUndefined();
      expect(plain.body.cost).toBeUndefined();
      const full = await user.client.post(path, {
        name: 'Pyramids',
        description: 'Giza tour',
        time: '09:30',
        cost: 45.5,
        currency: 'USD',
      });
      expect(full.status).toBe(201);
      expect(full.body).toMatchObject({
        time: '09:30',
        cost: 45.5,
        currency: 'USD',
      });
      for (const broken of [
        { name: '' },
        { description: '' },
        { time: '25:00' },
        { cost: -1, currency: 'USD' },
        { cost: 5, currency: 'XXX' },
      ]) {
        const res = await user.client.post(path, {
          name: 'N',
          description: 'D',
          ...broken,
        });
        expect(res.status).toBe(400);
      }
      const edited = await user.client.patch(
        `/api/activities/${full.body.id}`,
        { name: 'Giza', cost: 50 },
      );
      expect(edited.status).toBe(200);
      expect(edited.body).toMatchObject({
        name: 'Giza',
        description: 'Giza tour',
        cost: 50,
        time: '09:30',
      });
      expect(
        (
          await other.client.patch(`/api/activities/${full.body.id}`, {
            name: 'Hack',
          })
        ).status,
      ).toBe(404);
      expect(
        (await other.client.delete(`/api/activities/${full.body.id}`)).status,
      ).toBe(404);
      expect(
        (await user.client.delete(`/api/activities/${plain.body.id}`)).status,
      ).toBe(204);
      const after = await get(user, trip.id);
      expect((after.days[0].activities as any[]).map((a) => a.name)).toEqual([
        'Giza',
      ]);
    });

    it('attaches up to 5 JPG/PNG images of at most 5 MB to an activity and removes them', async () => {
      const trip = await create(user);
      const d = await addDay(user, trip.id, 'cairo');
      const activity = (
        await user.client.post(
          `/api/itineraries/${trip.id}/days/${d.id}/activities`,
          { name: 'Photo stop', description: 'View' },
        )
      ).body;
      const upload = (
        content: Buffer,
        filename: string,
        contentType: string,
        account = user,
      ) =>
        account.client.post(
          `/api/activities/${activity.id}/images`,
          undefined,
          { files: [{ field: 'image', content, filename, contentType }] },
        );
      expect(
        (await upload(Buffer.from('GIF89a'), 'a.gif', 'image/gif')).status,
      ).toBe(400);
      expect(
        (await upload(Buffer.from('not a png'), 'fake.png', 'image/png'))
          .status,
      ).toBe(400);
      expect(
        (
          await upload(
            Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 1)]),
            'big.png',
            'image/png',
          )
        ).status,
      ).toBe(400);
      expect((await upload(PNG, 'a.png', 'image/png', other)).status).toBe(404);
      const images = [];
      for (let i = 0; i < 5; i++) {
        const res = await upload(PNG, `${i}.png`, 'image/png');
        expect(res.status).toBe(201);
        images.push(res.body);
      }
      expect((await upload(PNG, '6.png', 'image/png')).status).toBe(400);
      // Stored on the server and served by URL.
      const served = await t.guest().get(images[0].url as string);
      expect(served.status).toBe(200);
      expect(served.buffer.equals(PNG)).toBe(true);
      expect(
        (
          await other.client.delete(
            `/api/activities/${activity.id}/images/${images[0].id}`,
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await user.client.delete(
            `/api/activities/${activity.id}/images/${images[0].id}`,
          )
        ).status,
      ).toBe(204);
      expect((await t.guest().get(images[0].url as string)).status).toBe(404);
      const after = await get(user, trip.id);
      expect(after.days[0].activities[0].images).toHaveLength(4);
      expect((await upload(PNG, 'again.png', 'image/png')).status).toBe(201);
    });
  });

  describe('ITN-14 budget (row 67), ITN-16 transport (row 68), ITN-18 conversion (row 69)', () => {
    let trip: { id: string };
    let d1: { id: string };
    let d2: { id: string };
    let entryId: string;
    let transportId: string;
    beforeAll(async () => {
      trip = await create(user);
      d1 = await addDay(user, trip.id, 'cairo');
      d2 = await addDay(user, trip.id, 'dubai');
      const budget = (dayId: string, body: unknown) =>
        user.client.post(
          `/api/itineraries/${trip.id}/days/${dayId}/budgets`,
          body,
        );
      entryId = (
        await budget(d1.id, { category: 'food', amount: 100, currency: 'USD' })
      ).body.id as string;
      await budget(d1.id, {
        category: 'accommodation',
        amount: 2000,
        currency: 'EGP',
      });
      await budget(d2.id, {
        category: 'in_city_transport',
        amount: 30.5,
        currency: 'USD',
      });
      await budget(d2.id, {
        category: 'activities',
        amount: 10,
        currency: 'USD',
      });
      // ITN-10 activity cost counts under Activities.
      await user.client.post(
        `/api/itineraries/${trip.id}/days/${d2.id}/activities`,
        { name: 'Tower', description: 'Top floor', cost: 40, currency: 'USD' },
      );
      // ITN-16 intercity transport on day 2.
      const transport = await user.client.post(
        `/api/itineraries/${trip.id}/transport-costs`,
        {
          dayId: d2.id,
          mode: 'flight',
          fromCityId: 'cairo',
          toCityId: 'dubai',
          amount: 250,
          currency: 'USD',
        },
      );
      expect(transport.status).toBe(201);
      expect(transport.body).toMatchObject({
        mode: 'flight',
        fromCityId: 'cairo',
        toCityId: 'dubai',
        amount: 250,
        currency: 'USD',
        dayId: d2.id,
      });
      transportId = transport.body.id as string;
    });

    it('totals by category and by day include budget entries, activity costs and intercity transport', async () => {
      const res = await user.client.get(
        `/api/itineraries/${trip.id}/budget-summary`,
        { query: { currency: 'USD' } },
      );
      expect(res.status).toBe(200);
      expect(res.body.totalsByCategory).toEqual({
        food: { USD: 100 },
        accommodation: { EGP: 2000 },
        in_city_transport: { USD: 30.5 },
        activities: { USD: 50 },
      });
      expect(res.body.intercityTransport).toEqual({ USD: 250 });
      expect(res.body.grandTotal).toEqual({ USD: 430.5, EGP: 2000 });
      expect(
        (res.body.totalsByDay as any[]).map((d) => [
          d.dayNumber,
          d.date,
          d.totals,
        ]),
      ).toEqual([
        [1, day(30), { USD: 100, EGP: 2000 }],
        [2, day(31), { USD: 330.5 }],
      ]);
      // ITN-09: the group subtotal.
      const full = await get(user, trip.id);
      expect(
        (full.cityGroups as any[]).map((g) => [g.cityId, g.budgetSubtotal]),
      ).toEqual([
        ['cairo', { USD: 100, EGP: 2000 }],
        ['dubai', { USD: 330.5 }],
      ]);
    });

    it('ITN-18: converts the amounts with the FXRatesAPI rates of the day, cached in the database, and shows the rate date', async () => {
      const res = await user.client.get(
        `/api/itineraries/${trip.id}/budget-summary`,
        { query: { currency: 'EUR' } },
      );
      expect(res.status).toBe(200);
      const cached = await t.collection('exchangerates').find({}).toArray();
      // Fetched once per day: one cached document for today.
      expect(cached).toHaveLength(1);
      expect(cached[0].fetchedDate).toBe(day(0));
      const rates = cached[0].rates as Record<string, number>;
      expect(rates.EUR).toBeGreaterThan(0);
      expect(rates.EGP).toBeGreaterThan(1);
      const toEur = (amount: number, from: string) =>
        (amount * rates.EUR) / (from === 'USD' ? 1 : rates[from]);
      const expected =
        Math.round((toEur(430.5, 'USD') + toEur(2000, 'EGP')) * 100) / 100;
      const converted = res.body.convertedTotal;
      expect(converted.currency).toBe('EUR');
      expect(converted.rateDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(converted.rateDate).toBe(cached[0].rateDate);
      expect(converted.ratesStale).toBe(false);
      expect(Object.keys(converted.grandTotal)).toEqual(['EUR']);
      expect(Math.abs(converted.grandTotal.EUR - expected)).toBeLessThanOrEqual(
        0.01,
      );
      expect(
        Math.abs(
          converted.totalsByCategory.accommodation.EUR -
            Math.round(toEur(2000, 'EGP') * 100) / 100,
        ),
      ).toBeLessThanOrEqual(0.01);
      // The original amounts stay as entered.
      expect(res.body.grandTotal).toEqual({ USD: 430.5, EGP: 2000 });
      // A second request the same day uses the cache: still one document.
      await user.client.get(`/api/itineraries/${trip.id}/budget-summary`, {
        query: { currency: 'JPY' },
      });
      expect(await t.collection('exchangerates').countDocuments({})).toBe(1);
    });

    it("ITN-18: without a currency in the request the user's preferred currency is used", async () => {
      await user.client.patch('/api/users/me', { preferredCurrency: 'GBP' });
      const res = await user.client.get(
        `/api/itineraries/${trip.id}/budget-summary`,
      );
      expect(res.body.convertedTotal.currency).toBe('GBP');
      expect(Object.keys(res.body.convertedTotal.grandTotal)).toEqual(['GBP']);
    });

    it('rejects an invalid or unsupported currency code', async () => {
      expect(
        (
          await user.client.get(`/api/itineraries/${trip.id}/budget-summary`, {
            query: { currency: 'XXX' },
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await user.client.get(`/api/itineraries/${trip.id}/budget-summary`, {
            query: { currency: 'EURO' },
          })
        ).status,
      ).toBe(400);
      const budgets = `/api/itineraries/${trip.id}/days/${d1.id}/budgets`;
      expect(
        (
          await user.client.post(budgets, {
            category: 'food',
            amount: 5,
            currency: 'XXX',
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await user.client.post(budgets, {
            category: 'food',
            amount: -1,
            currency: 'USD',
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await user.client.post(budgets, {
            category: 'shopping',
            amount: 5,
            currency: 'USD',
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await user.client.post(budgets, {
            category: 'food',
            amount: 0,
            currency: 'USD',
          })
        ).status,
      ).toBe(201);
    });

    it('edits and deletes budget entries and transport costs; totals follow', async () => {
      expect(
        (
          await user.client.patch(`/api/budgets/${entryId}`, {
            amount: 150,
            category: 'activities',
          })
        ).status,
      ).toBe(200);
      expect(
        (await other.client.patch(`/api/budgets/${entryId}`, { amount: 1 }))
          .status,
      ).toBe(404);
      expect(
        (
          await user.client.patch(`/api/transport-costs/${transportId}`, {
            amount: 300,
            mode: 'train',
          })
        ).body,
      ).toMatchObject({ amount: 300, mode: 'train' });
      expect(
        (await other.client.delete(`/api/transport-costs/${transportId}`))
          .status,
      ).toBe(404);
      let summary = (
        await user.client.get(`/api/itineraries/${trip.id}/budget-summary`, {
          query: { currency: 'USD' },
        })
      ).body;
      expect(summary.totalsByCategory.food).toEqual({ USD: 0 });
      expect(summary.totalsByCategory.activities).toEqual({ USD: 200 });
      expect(summary.intercityTransport).toEqual({ USD: 300 });
      expect((await user.client.delete(`/api/budgets/${entryId}`)).status).toBe(
        204,
      );
      expect(
        (await user.client.delete(`/api/transport-costs/${transportId}`))
          .status,
      ).toBe(204);
      summary = (
        await user.client.get(`/api/itineraries/${trip.id}/budget-summary`, {
          query: { currency: 'USD' },
        })
      ).body;
      expect(summary.totalsByCategory.activities).toEqual({ USD: 50 });
      expect(summary.intercityTransport).toEqual({});
      // ITN-07: deleting a day removes its amounts from the totals.
      expect(
        (
          await user.client.delete(
            `/api/itineraries/${trip.id}/days/${d2.id}`,
            { query: { confirm: true } },
          )
        ).status,
      ).toBe(204);
      summary = (
        await user.client.get(`/api/itineraries/${trip.id}/budget-summary`, {
          query: { currency: 'USD' },
        })
      ).body;
      expect(summary.grandTotal).toEqual({ USD: 0, EGP: 2000 });
      expect(summary.totalsByDay).toHaveLength(1);
    });

    it('ITN-16: a transport cost needs a day of the itinerary, cities from the list and a supported currency', async () => {
      const mine = await create(user);
      const dayOfMine = await addDay(user, mine.id, 'cairo');
      const post = (body: Record<string, unknown>) =>
        user.client.post(`/api/itineraries/${mine.id}/transport-costs`, {
          dayId: dayOfMine.id,
          mode: 'bus',
          fromCityId: 'cairo',
          toCityId: 'dubai',
          amount: 10,
          currency: 'USD',
          ...body,
        });
      expect((await post({ dayId: d1.id })).status).toBe(400);
      expect((await post({ fromCityId: 'atlantis' })).status).toBe(400);
      expect((await post({ mode: 'rocket' })).status).toBe(400);
      expect((await post({ amount: -5 })).status).toBe(400);
      expect((await post({ currency: 'XXX' })).status).toBe(400);
      expect((await post({})).status).toBe(201);
    });
  });

  describe('ITN-20 visibility (row 70), ITN-21 public search, view and clone (row 71)', () => {
    let title: string;
    let trip: { id: string };
    beforeAll(async () => {
      title = `Sakura ${unique('s')}`;
      trip = await create(user, { title, countryCodes: ['JP'] });
      const d1 = await addDay(user, trip.id, 'tokyo');
      await addDay(user, trip.id, 'tokyo');
      await addDay(user, trip.id, 'tokyo');
      await user.client.post(
        `/api/itineraries/${trip.id}/days/${d1.id}/activities`,
        { name: 'Temple', description: 'Senso-ji', cost: 20, currency: 'USD' },
      );
      await user.client.post(
        `/api/itineraries/${trip.id}/days/${d1.id}/budgets`,
        { category: 'food', amount: 60, currency: 'USD' },
      );
      await user.client.post(`/api/itineraries/${trip.id}/transport-costs`, {
        dayId: d1.id,
        mode: 'train',
        fromCityId: 'tokyo',
        toCityId: 'cairo',
        amount: 15,
        currency: 'USD',
      });
    });
    const found = async (query: Record<string, string | number>) =>
      (
        (await t.guest().get('/api/itineraries/public/search', { query })).body
          .items as any[]
      ).map((i) => i.id);

    it('a private itinerary is not in the public search; Public adds it, Private removes it immediately', async () => {
      expect(await found({ keyword: title })).toEqual([]);
      expect((await publish(user, trip.id)).status).toBe(200);
      expect(await found({ keyword: title })).toEqual([trip.id]);
      expect(
        (await t.guest().get(`/api/itineraries/public/${trip.id}`)).status,
      ).toBe(200);
      await user.client.patch(`/api/itineraries/${trip.id}`, {
        visibility: 'private',
      });
      expect(await found({ keyword: title })).toEqual([]);
      expect(
        (await t.guest().get(`/api/itineraries/public/${trip.id}`)).status,
      ).toBe(404);
      await publish(user, trip.id);
      expect(
        (
          await user.client.patch(`/api/itineraries/${trip.id}`, {
            visibility: 'secret',
          })
        ).status,
      ).toBe(400);
    });

    it('searches by keyword matching title, country or city and filters by duration and by country or city', async () => {
      const paris = await create(user, {
        title: `Louvre ${unique('p')}`,
        countryCodes: ['FR'],
      });
      await addDay(user, paris.id, 'paris');
      await publish(user, paris.id);
      const mine = (list: string[]) =>
        list.filter((id) => [trip.id, paris.id].includes(id)).sort();
      expect(
        mine(await found({ keyword: title.slice(0, 6).toUpperCase() })),
      ).toEqual([trip.id]);
      expect(mine(await found({ keyword: 'japan' }))).toEqual([trip.id]);
      expect(mine(await found({ keyword: 'Tokyo' }))).toEqual([trip.id]);
      expect(mine(await found({ keyword: 'france' }))).toEqual([paris.id]);
      expect(mine(await found({ country: 'JP' }))).toEqual([trip.id]);
      expect(mine(await found({ city: 'paris' }))).toEqual([paris.id]);
      expect(mine(await found({ minDays: 3 }))).toEqual([trip.id]);
      expect(mine(await found({ maxDays: 2 }))).toEqual([paris.id]);
      expect(mine(await found({ minDays: 1, maxDays: 3 }))).toEqual(
        [trip.id, paris.id].sort(),
      );
      expect(mine(await found({ minDays: 4 }))).toEqual([]);
      expect(mine(await found({ keyword: title, country: 'FR' }))).toEqual([]);
      expect(
        (
          await t.guest().get('/api/itineraries/public/search', {
            query: { minDays: 5, maxDays: 2 },
          })
        ).status,
      ).toBe(400);
      const none = await t.guest().get('/api/itineraries/public/search', {
        query: { keyword: unique('nothing') },
      });
      expect(none.status).toBe(200);
      expect(none.body.items).toEqual([]);
    });

    it('a public itinerary is shown read-only with author, days, activities and budget', async () => {
      const res = await t.guest().get(`/api/itineraries/public/${trip.id}`);
      expect(res.status).toBe(200);
      expect(res.body.author).toEqual({ id: user.id, name: 'Itinerary Owner' });
      expect(res.body.days).toHaveLength(3);
      expect(res.body.days[0].activities[0]).toMatchObject({
        name: 'Temple',
        cost: 20,
      });
      expect(res.body.budget.grandTotal).toEqual({ USD: 95 });
      // Read-only to other users.
      expect(
        (
          await other.client.patch(`/api/itineraries/${trip.id}`, {
            title: 'Mine now',
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await other.client.post(`/api/itineraries/${trip.id}/days`, {
            cityId: 'tokyo',
          })
        ).status,
      ).toBe(404);
      expect(
        (await other.client.delete(`/api/itineraries/${trip.id}`)).status,
      ).toBe(404);
    });

    it('a clone has all days, activities and budgets, is private, credits the author and is independent', async () => {
      expect(
        (await t.guest().post(`/api/itineraries/${trip.id}/clone`)).status,
      ).toBe(401);
      const res = await other.client.post(`/api/itineraries/${trip.id}/clone`);
      expect(res.status).toBe(201);
      const clone = res.body;
      expect(clone.id).not.toBe(trip.id);
      expect(clone).toMatchObject({
        title,
        visibility: 'private',
        countryCodes: ['JP'],
        originalItineraryId: trip.id,
        originalAuthorId: user.id,
      });
      expect(clone.days).toHaveLength(3);
      expect(clone.days[0].activities[0]).toMatchObject({
        name: 'Temple',
        description: 'Senso-ji',
        cost: 20,
        currency: 'USD',
      });
      expect(clone.days[0].budgets[0]).toMatchObject({
        category: 'food',
        amount: 60,
        currency: 'USD',
      });
      expect(clone.transportCosts[0]).toMatchObject({
        mode: 'train',
        amount: 15,
        dayId: clone.days[0].id,
      });
      // Private: not in the search, not readable by the original author.
      expect((await found({ keyword: title })).sort()).toEqual([trip.id]);
      expect(
        (await user.client.get(`/api/itineraries/${clone.id}`)).status,
      ).toBe(404);
      // Independent in both directions.
      await other.client.patch(`/api/itineraries/${clone.id}`, {
        title: 'My copy',
      });
      await other.client.delete(
        `/api/itineraries/${clone.id}/days/${clone.days[2].id}`,
        { query: { confirm: true } },
      );
      await user.client.patch(
        `/api/activities/${(await get(user, trip.id)).days[0].activities[0].id}`,
        { name: 'Changed in the original' },
      );
      const original = await get(user, trip.id);
      expect(original.title).toBe(title);
      expect(original.days).toHaveLength(3);
      const copy = await get(other, clone.id);
      expect(copy.days).toHaveLength(2);
      expect(copy.days[0].activities[0].name).toBe('Temple');
      const budget = (
        await other.client.get(`/api/itineraries/${clone.id}/budget-summary`, {
          query: { currency: 'USD' },
        })
      ).body;
      expect(budget.grandTotal).toEqual({ USD: 95 });
    });

    it('ITN-01: deleting an itinerary removes it from the public search; earlier clones stay', async () => {
      const source = await create(user, {
        title: `Short lived ${unique('d')}`,
      });
      await addDay(user, source.id, 'cairo');
      await publish(user, source.id);
      const clone = (
        await other.client.post(`/api/itineraries/${source.id}/clone`)
      ).body;
      expect(
        (await user.client.delete(`/api/itineraries/${source.id}`)).status,
      ).toBe(204);
      expect(await found({ keyword: source.title })).toEqual([]);
      expect(
        (await t.guest().get(`/api/itineraries/public/${source.id}`)).status,
      ).toBe(404);
      expect(
        (await user.client.get(`/api/itineraries/${source.id}`)).status,
      ).toBe(404);
      const kept = await get(other, clone.id);
      expect(kept.days).toHaveLength(1);
      expect(kept.originalAuthorId).toBe(user.id);
    });
  });

  describe('ITN-25 hotels for a city group (row 72), ITN-26 flights to the itinerary (row 73)', () => {
    it('searches hotels for the group: check-in = first day, check-out = the day after the last day', async () => {
      const hotel = await hotelWithModerator(t, {
        cityId: 'london',
        countryCode: 'GB',
      });
      await addRoom(hotel, {
        maxOccupancy: 2,
        availableFrom: 40,
        availableTo: 43,
      });
      const elsewhere = await hotelWithModerator(t, {
        cityId: 'paris',
        countryCode: 'FR',
      });
      await addRoom(elsewhere);
      const trip = await create(user, {
        startDate: day(40),
        countryCodes: ['GB', 'FR'],
      });
      const l1 = await addDay(user, trip.id, 'london');
      await addDay(user, trip.id, 'london');
      const l3 = await addDay(user, trip.id, 'london');
      const p = await addDay(user, trip.id, 'paris');
      const res = await user.client.get(`/api/itineraries/${trip.id}/hotels`, {
        query: { dayId: l3.id, guests: 2 },
      });
      expect(res.status).toBe(200);
      // Days 40, 41, 42 in London: check-in day 40, check-out day 43.
      expect(res.body).toMatchObject({
        cityId: 'london',
        checkIn: day(40),
        checkOut: day(43),
      });
      const hotelIds = (res.body.items as any[]).map((h) => h.id);
      expect(hotelIds).toContain(hotel.hotelId);
      expect(hotelIds).not.toContain(elsewhere.hotelId);
      // Any day of the group gives the same group.
      const sameGroup = await user.client.get(
        `/api/itineraries/${trip.id}/hotels`,
        { query: { dayId: l1.id, guests: 2 } },
      );
      expect(sameGroup.body).toMatchObject({
        checkIn: day(40),
        checkOut: day(43),
      });
      // The guest count and rooms are those the user enters (HTL-11 rules).
      const three = await user.client.get(
        `/api/itineraries/${trip.id}/hotels`,
        { query: { dayId: l1.id, guests: 3 } },
      );
      expect((three.body.items as any[]).map((h) => h.id)).not.toContain(
        hotel.hotelId,
      );
      const paris = await user.client.get(
        `/api/itineraries/${trip.id}/hotels`,
        { query: { dayId: p.id, guests: 1 } },
      );
      expect(paris.body).toMatchObject({
        cityId: 'paris',
        checkIn: day(43),
        checkOut: day(44),
      });
      expect((paris.body.items as any[]).map((h) => h.id)).toContain(
        elsewhere.hotelId,
      );
      expect(
        (
          await user.client.get(`/api/itineraries/${trip.id}/hotels`, {
            query: { dayId: l1.id },
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await other.client.get(`/api/itineraries/${trip.id}/hotels`, {
            query: { dayId: l1.id, guests: 1 },
          })
        ).status,
      ).toBe(404);
    });

    it("searches flights from the chosen origin to the airport of the first day's city; dates default to the start and the last day", async () => {
      const airline = await airlineWithModerator(t);
      const out = await bookableFlight(airline, {
        from: 'CAI',
        to: 'FRA',
        inDays: 60,
        departureTime: '08:00',
        arrivalTime: '12:00',
      });
      const back = await bookableFlight(airline, {
        from: 'FRA',
        to: 'CAI',
        inDays: 62,
        departureTime: '15:00',
        arrivalTime: '20:00',
      });
      const otherDay = await bookableFlight(airline, {
        from: 'CAI',
        to: 'FRA',
        inDays: 61,
        departureTime: '08:00',
        arrivalTime: '12:00',
      });
      const trip = await create(user, {
        startDate: day(60),
        countryCodes: ['DE'],
      });
      await addDay(user, trip.id, 'frankfurt');
      await addDay(user, trip.id, 'frankfurt');
      await addDay(user, trip.id, 'paris');
      const oneWay = await user.client.get(
        `/api/itineraries/${trip.id}/flights`,
        { query: { origin: 'CAI' } },
      );
      expect(oneWay.status).toBe(200);
      expect((oneWay.body.items as any[]).map((f) => f.id)).toEqual([out.id]);
      const round = await user.client.get(
        `/api/itineraries/${trip.id}/flights`,
        { query: { origin: 'CAI', tripType: 'round_trip' } },
      );
      expect((round.body.outbound.items as any[]).map((f) => f.id)).toEqual([
        out.id,
      ]);
      // The last day (day 3) is day 62.
      expect((round.body.return.items as any[]).map((f) => f.id)).toEqual([
        back.id,
      ]);
      // The defaults can be replaced.
      const later = await user.client.get(
        `/api/itineraries/${trip.id}/flights`,
        { query: { origin: 'CAI', departureDate: day(61) } },
      );
      expect((later.body.items as any[]).map((f) => f.id)).toEqual([
        otherDay.id,
      ]);
      // FLT-12 rules are reused.
      expect(
        (
          await user.client.get(`/api/itineraries/${trip.id}/flights`, {
            query: { origin: 'CAI', adults: 1, infants: 2 },
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await user.client.get(`/api/itineraries/${trip.id}/flights`, {
            query: { origin: 'ZZZ' },
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await other.client.get(`/api/itineraries/${trip.id}/flights`, {
            query: { origin: 'CAI' },
          })
        ).status,
      ).toBe(404);
      const empty = await create(user);
      expect(
        (
          await user.client.get(`/api/itineraries/${empty.id}/flights`, {
            query: { origin: 'CAI' },
          })
        ).status,
      ).toBe(400);
    });
  });
});
