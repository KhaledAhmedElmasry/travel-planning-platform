// System tests: hotels, rooms, availability, search, reservations, cancellation and reviews.
// Payments and refunds run against Stripe test mode with real webhooks.
// Expected results come from the Excel sheet "Mandatory" (row in brackets) and the project
// description sections 6.3, 8.5 and 8.6.
import { HotelBookingLifecycleService } from '../../src/hotel-bookings/hotel-booking-lifecycle.service';
import { Account, JPG, PNG, TestApp, day } from '../support/harness';
import {
  HotelSetup,
  acceptPolicies,
  addRoom,
  bookingDetails,
  hotelWithModerator,
  notifications,
  payAndConfirm,
} from '../support/scenarios';

describe('Hotels, reservations and reviews', () => {
  const t = new TestApp();
  let user: Account;
  beforeAll(async () => {
    await t.start();
    user = await t.user('Hotel Guest');
  });
  afterAll(() => t.stop());

  const search = (query: Record<string, string | number | undefined>) =>
    t.guest().get('/api/hotels/search', { query });
  const ids = (res: { body: { items: { id: string }[] } }) =>
    res.body.items.map((h) => h.id);
  const book = (
    account: Account,
    hotelId: string,
    checkIn: number,
    checkOut: number,
    rooms: { roomId: string; adults: number; childrenAges?: number[] }[],
  ) =>
    account.client.post('/api/hotel-bookings', {
      hotelId,
      checkIn: day(checkIn),
      checkOut: day(checkOut),
      rooms,
    });
  const photo = (content: Buffer, filename: string, contentType: string) => ({
    field: 'photos',
    content,
    filename,
    contentType,
  });

  describe('HTL-01 hotel profile (Mandatory row 36), GEN-08 photos', () => {
    it('an admin creates a hotel with name, address, city and country, description, photos, star class, amenities', async () => {
      const admin = await t.admin();
      const res = await admin.post('/api/hotels', undefined, {
        fields: {
          name: 'Nile View',
          address: '5 Corniche',
          cityId: 'cairo',
          countryCode: 'EG',
          description: 'By the river.',
          starRating: '5',
          amenities: ['pool', 'wifi'],
        },
        files: [
          photo(PNG, 'a.png', 'image/png'),
          photo(JPG, 'b.jpg', 'image/jpeg'),
        ],
      });
      expect(res.status).toBe(201);
      const shown = await t.guest().get(`/api/hotels/${res.body.id}`);
      expect(shown.status).toBe(200);
      expect(shown.body).toMatchObject({
        name: 'Nile View',
        address: '5 Corniche',
        cityId: 'cairo',
        countryCode: 'EG',
        description: 'By the river.',
        starRating: 5,
        amenities: ['pool', 'wifi'],
      });
      expect(shown.body.photos).toHaveLength(2);
      const file = await t.guest().get(shown.body.photos[0].url as string);
      expect(file.status).toBe(200);
      expect(file.buffer.equals(PNG)).toBe(true);
    });

    it('rejects a city that is not in the given country and unknown reference data (GEN-12)', async () => {
      const admin = await t.admin();
      const fields = {
        name: 'X',
        address: 'Y',
        description: 'Z',
        starRating: '3',
      };
      expect(
        (
          await admin.post('/api/hotels', undefined, {
            fields: { ...fields, cityId: 'cairo', countryCode: 'FR' },
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await admin.post('/api/hotels', undefined, {
            fields: { ...fields, cityId: 'atlantis', countryCode: 'EG' },
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await admin.post('/api/hotels', undefined, {
            fields: {
              ...fields,
              cityId: 'cairo',
              countryCode: 'EG',
              starRating: '6',
            },
          })
        ).status,
      ).toBe(400);
    });

    it('only an admin creates hotels; only the own moderator edits the profile', async () => {
      const hotel = await hotelWithModerator(t);
      const other = await hotelWithModerator(t);
      const fields = {
        name: 'Mine',
        address: 'A',
        cityId: 'cairo',
        countryCode: 'EG',
        description: 'D',
        starRating: '3',
      };
      expect(
        (
          await hotel.moderator.client.post('/api/hotels', undefined, {
            fields,
          })
        ).status,
      ).toBe(403);
      expect(
        (await t.guest().post('/api/hotels', undefined, { fields })).status,
      ).toBe(401);

      const edited = await hotel.moderator.client.patch(
        `/api/hotels/${hotel.hotelId}`,
        undefined,
        {
          fields: {
            name: 'Renamed Hotel',
            description: 'New text',
            starRating: '2',
            amenities: ['spa'],
          },
        },
      );
      expect(edited.status).toBe(200);
      expect(
        (await t.guest().get(`/api/hotels/${hotel.hotelId}`)).body,
      ).toMatchObject({
        name: 'Renamed Hotel',
        description: 'New text',
        starRating: 2,
        amenities: ['spa'],
      });
      expect(
        (
          await other.moderator.client.patch(
            `/api/hotels/${hotel.hotelId}`,
            undefined,
            { fields: { name: 'Taken' } },
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await (
            await t.admin()
          ).patch(`/api/hotels/${hotel.hotelId}`, undefined, {
            fields: { name: 'Admin' },
          })
        ).status,
      ).toBe(403);
    });

    it('GEN-08: at most 5 photos per hotel, JPG or PNG, up to 5 MB each', async () => {
      const hotel = await hotelWithModerator(t);
      const upload = (files: ReturnType<typeof photo>[]) =>
        hotel.moderator.client.patch(
          `/api/hotels/${hotel.hotelId}`,
          undefined,
          { files },
        );
      expect(
        (await upload([photo(Buffer.from('GIF89a'), 'x.gif', 'image/gif')]))
          .status,
      ).toBe(400);
      const tooBig = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 1)]);
      expect(
        (await upload([photo(tooBig, 'big.png', 'image/png')])).status,
      ).toBe(400);
      const five = [1, 2, 3, 4, 5].map((n) =>
        photo(PNG, `${n}.png`, 'image/png'),
      );
      expect((await upload(five)).status).toBe(200);
      expect((await upload([photo(PNG, '6.png', 'image/png')])).status).toBe(
        400,
      );
      expect(
        (await t.guest().get(`/api/hotels/${hotel.hotelId}`)).body.photos,
      ).toHaveLength(5);
    });
  });

  describe('HTL-03 rooms (Mandatory row 38)', () => {
    it('adds a room with a number unique within the hotel, type, beds, occupancy >= 1 and price > 0', async () => {
      const hotel = await hotelWithModerator(t);
      const other = await hotelWithModerator(t);
      const body = {
        roomNumber: '101',
        type: 'Twin',
        beds: 2,
        maxOccupancy: 3,
        pricePerNight: 8000,
      };
      const res = await hotel.moderator.client.post(
        `/api/hotels/${hotel.hotelId}/rooms`,
        body,
      );
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        ...body,
        hotelId: hotel.hotelId,
        currency: 'USD',
      });
      expect(
        (
          await hotel.moderator.client.post(
            `/api/hotels/${hotel.hotelId}/rooms`,
            body,
          )
        ).status,
      ).toBe(409);
      // The same number in another hotel is fine.
      expect(
        (
          await other.moderator.client.post(
            `/api/hotels/${other.hotelId}/rooms`,
            body,
          )
        ).status,
      ).toBe(201);
      for (const broken of [
        { maxOccupancy: 0 },
        { pricePerNight: 0 },
        { beds: 0 },
        { roomNumber: '' },
        { type: '' },
      ]) {
        const bad = await hotel.moderator.client.post(
          `/api/hotels/${hotel.hotelId}/rooms`,
          { ...body, roomNumber: '102', ...broken },
        );
        expect(bad.status).toBe(400);
      }
      expect(
        (
          await other.moderator.client.post(
            `/api/hotels/${hotel.hotelId}/rooms`,
            { ...body, roomNumber: '103' },
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await user.client.post(`/api/hotels/${hotel.hotelId}/rooms`, {
            ...body,
            roomNumber: '104',
          })
        ).status,
      ).toBe(403);
    });
  });

  describe('HTL-04 bookable ranges (Mandatory row 39), HTL-08 calendar (row 42)', () => {
    it('bookable date ranges of a room cannot overlap', async () => {
      const hotel = await hotelWithModerator(t);
      const room = await addRoom(hotel, { noAvailability: true });
      const add = (from: number, to: number) =>
        hotel.moderator.client.post(
          `/api/hotels/${hotel.hotelId}/rooms/${room.id}/availability`,
          { from: day(from), to: day(to) },
        );
      expect((await add(10, 20)).status).toBe(201);
      expect((await add(20, 25)).status).toBe(409);
      expect((await add(5, 10)).status).toBe(409);
      expect((await add(12, 14)).status).toBe(409);
      expect((await add(1, 30)).status).toBe(409);
      const next = await add(21, 30);
      expect(next.status).toBe(201);
      expect(next.body.availableRanges).toEqual([
        { from: day(10), to: day(20) },
        { from: day(21), to: day(30) },
      ]);
      expect((await add(40, 39)).status).toBe(400);
    });

    it('shows each room as Available, Booked (with the reservation reference) or Blocked', async () => {
      const hotel = await hotelWithModerator(t);
      const room = await addRoom(hotel, {
        roomNumber: 'A1',
        availableFrom: 10,
        availableTo: 16,
      });
      const block = await hotel.moderator.client.patch(
        `/api/hotels/${hotel.hotelId}/rooms/${room.id}/availability`,
        { action: 'block', from: day(15), to: day(16) },
      );
      expect(block.status).toBe(200);
      const booking = (
        await book(user, hotel.hotelId, 11, 13, [
          { roomId: room.id, adults: 1 },
        ])
      ).body;
      const confirmed = (
        await payAndConfirm(t, user.client, 'hotel', booking.id as string)
      ).booking;

      const res = await hotel.moderator.client.get(
        `/api/hotels/${hotel.hotelId}/availability`,
        { query: { from: day(10), to: day(16) } },
      );
      expect(res.status).toBe(200);
      const calendar = (res.body.items as any[]).find((r) => r.id === room.id);
      expect(calendar.dates).toEqual([
        { date: day(10), status: 'available', reference: null },
        { date: day(11), status: 'booked', reference: confirmed.reference },
        { date: day(12), status: 'booked', reference: confirmed.reference },
        { date: day(13), status: 'available', reference: null },
        { date: day(14), status: 'available', reference: null },
        { date: day(15), status: 'blocked', reference: null },
        { date: day(16), status: 'blocked', reference: null },
      ]);
      const other = await hotelWithModerator(t);
      expect(
        (
          await other.moderator.client.get(
            `/api/hotels/${hotel.hotelId}/availability`,
            { query: { from: day(10), to: day(16) } },
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await user.client.get(`/api/hotels/${hotel.hotelId}/availability`, {
            query: { from: day(10), to: day(16) },
          })
        ).status,
      ).toBe(403);
    });
  });

  describe('HTL-09 times and HTL-10 tiers (Mandatory rows 43-44), HTL-02 details (row 37)', () => {
    it('the moderator sets check-in/check-out times and tiers; the hotel page shows them', async () => {
      const hotel = await hotelWithModerator(t);
      const put = (body: unknown) =>
        hotel.moderator.client.put(
          `/api/hotels/${hotel.hotelId}/policies`,
          body,
        );
      const times = { checkInTime: '15:00', checkOutTime: '11:00' };
      const ok = await put({
        ...times,
        cancellationTiers: [
          { daysBefore: 3, refundPercentage: 50 },
          { daysBefore: 14, refundPercentage: 100 },
        ],
      });
      expect(ok.status).toBe(200);
      const page = await t.guest().get(`/api/hotels/${hotel.hotelId}`);
      expect(page.body).toMatchObject({
        checkInTime: '15:00',
        checkOutTime: '11:00',
        averageRating: 0,
        ratingCount: 0,
      });
      expect(page.body.cancellationTiers).toEqual([
        { daysBefore: 14, refundPercentage: 100 },
        { daysBefore: 3, refundPercentage: 50 },
      ]);
      expect(
        (
          await put({
            ...times,
            cancellationTiers: [
              { daysBefore: 3, refundPercentage: 50 },
              { daysBefore: 3, refundPercentage: 60 },
            ],
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await put({
            ...times,
            cancellationTiers: [{ daysBefore: -1, refundPercentage: 50 }],
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await put({
            ...times,
            cancellationTiers: [{ daysBefore: 1.5, refundPercentage: 50 }],
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await put({
            ...times,
            cancellationTiers: [{ daysBefore: 1, refundPercentage: 101 }],
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await put({
            checkInTime: '25:00',
            checkOutTime: '11:00',
            cancellationTiers: [],
          })
        ).status,
      ).toBe(400);
      const other = await hotelWithModerator(t);
      expect(
        (
          await other.moderator.client.put(
            `/api/hotels/${hotel.hotelId}/policies`,
            { ...times, cancellationTiers: [] },
          )
        ).status,
      ).toBe(403);
    });

    it('the hotel page shows the available rooms when dates are provided', async () => {
      const hotel = await hotelWithModerator(t);
      const free = await addRoom(hotel, { pricePerNight: 7000 });
      const notYet = await addRoom(hotel, {
        availableFrom: 60,
        availableTo: 70,
      });
      const without = await t.guest().get(`/api/hotels/${hotel.hotelId}`);
      expect(without.body.availableRooms).toBeUndefined();
      const res = await t.guest().get(`/api/hotels/${hotel.hotelId}`, {
        query: { checkIn: day(20), checkOut: day(23) },
      });
      const rooms = res.body.availableRooms as any[];
      expect(rooms.map((r) => r.id)).toEqual([free.id]);
      expect(rooms.map((r) => r.id)).not.toContain(notYet.id);
      expect(rooms[0]).toMatchObject({
        pricePerNight: 7000,
        nights: 3,
        totalPrice: 21000,
        currency: 'USD',
      });
      expect(
        (await t.guest().get('/api/hotels/000000000000000000000000')).status,
      ).toBe(404);
    });
  });

  describe('HTL-11 search (Mandatory row 45), HTL-12 filters (row 46), HTL-15 rooms (row 47)', () => {
    let small: HotelSetup;
    let large: HotelSetup;
    let off: HotelSetup;
    const stay = { checkIn: day(30), checkOut: day(33) };
    beforeAll(async () => {
      const place = { cityId: 'tokyo', countryCode: 'JP' };
      small = await hotelWithModerator(t, place);
      large = await hotelWithModerator(t, place);
      off = await hotelWithModerator(t, place);
      await addRoom(small, { maxOccupancy: 2, pricePerNight: 5000 });
      await addRoom(large, { maxOccupancy: 2, pricePerNight: 9000 });
      await addRoom(large, { maxOccupancy: 4, pricePerNight: 12000 });
      await addRoom(large, { maxOccupancy: 1, pricePerNight: 3000 });
      await addRoom(off, { maxOccupancy: 4, pricePerNight: 1000 });
      const admin = await t.admin();
      await admin.patch(
        `/api/admin/providers/hotel/${off.hotelId}/deactivate`,
        {},
      );
    });

    it('lists active hotels with enough free rooms whose combined occupancy covers the guests', async () => {
      const two = await search({ city: 'tokyo', ...stay, guests: 2 });
      expect(two.status).toBe(200);
      expect(ids(two)).toEqual(
        expect.arrayContaining([small.hotelId, large.hotelId]),
      );
      // ACC-15: a deactivated hotel is hidden from search.
      expect(ids(two)).not.toContain(off.hotelId);
      // 4 guests in 1 room: only the large hotel has a room for 4.
      const four = await search({ city: 'tokyo', ...stay, guests: 4 });
      expect(ids(four)).toContain(large.hotelId);
      expect(ids(four)).not.toContain(small.hotelId);
      // 6 guests in 2 rooms: 4 + 2 in the large hotel. 7 guests in 2 rooms: nowhere.
      expect(
        ids(await search({ city: 'tokyo', ...stay, guests: 6, rooms: 2 })),
      ).toContain(large.hotelId);
      expect(
        ids(await search({ city: 'tokyo', ...stay, guests: 7, rooms: 2 })),
      ).not.toContain(large.hotelId);
      // 2 rooms: the small hotel has only one.
      expect(
        ids(await search({ city: 'tokyo', ...stay, guests: 2, rooms: 2 })),
      ).not.toContain(small.hotelId);
      // By country.
      expect(ids(await search({ country: 'JP', ...stay, guests: 2 }))).toEqual(
        expect.arrayContaining([small.hotelId, large.hotelId]),
      );
      expect(
        ids(await search({ country: 'FR', ...stay, guests: 2 })),
      ).not.toContain(small.hotelId);
    });

    it('the rooms must be free for the whole stay', async () => {
      const hotel = await hotelWithModerator(t, {
        cityId: 'tokyo',
        countryCode: 'JP',
      });
      await addRoom(hotel, { availableFrom: 30, availableTo: 31 });
      // Nights 30, 31 and 32 are needed; night 32 is not bookable.
      expect(
        ids(await search({ city: 'tokyo', ...stay, guests: 1 })),
      ).not.toContain(hotel.hotelId);
      expect(
        ids(
          await search({
            city: 'tokyo',
            checkIn: day(30),
            checkOut: day(32),
            guests: 1,
          }),
        ),
      ).toContain(hotel.hotelId);
    });

    it('check-out must be after check-in and check-in cannot be in the past', async () => {
      expect(
        (
          await search({
            city: 'tokyo',
            checkIn: day(30),
            checkOut: day(30),
            guests: 1,
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await search({
            city: 'tokyo',
            checkIn: day(31),
            checkOut: day(30),
            guests: 1,
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await search({
            city: 'tokyo',
            checkIn: day(-1),
            checkOut: day(2),
            guests: 1,
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await search({
            city: 'tokyo',
            checkIn: day(0),
            checkOut: day(1),
            guests: 1,
          })
        ).status,
      ).toBe(200);
      expect((await search({ ...stay, guests: 1 })).status).toBe(400);
      expect((await search({ city: 'tokyo', ...stay })).status).toBe(400);
    });

    it('HTL-12: filters by the inclusive price of the cheapest qualifying room and sorts by it', async () => {
      // For 2 guests in 1 room the cheapest qualifying room: small 5000, large 9000 (the 3000
      // room only takes 1 guest).
      const found = await search({
        city: 'tokyo',
        ...stay,
        guests: 2,
        sortBy: 'price',
      });
      const prices = Object.fromEntries(
        (found.body.items as any[]).map((h) => [h.id, h.pricePerNight]),
      );
      expect(prices[small.hotelId]).toBe(5000);
      expect(prices[large.hotelId]).toBe(9000);
      const order = ids(found).filter((id) =>
        [small.hotelId, large.hotelId].includes(id),
      );
      expect(order).toEqual([small.hotelId, large.hotelId]);
      const desc = ids(
        await search({
          city: 'tokyo',
          ...stay,
          guests: 2,
          sortBy: 'price',
          sortOrder: 'desc',
        }),
      ).filter((id) => [small.hotelId, large.hotelId].includes(id));
      expect(desc).toEqual([large.hotelId, small.hotelId]);
      const inRange = ids(
        await search({
          city: 'tokyo',
          ...stay,
          guests: 2,
          minPrice: 5001,
          maxPrice: 9000,
        }),
      );
      expect(inRange).toContain(large.hotelId);
      expect(inRange).not.toContain(small.hotelId);
      expect(
        ids(
          await search({
            city: 'tokyo',
            ...stay,
            guests: 2,
            minPrice: 5000,
            maxPrice: 5000,
          }),
        ),
      ).toContain(small.hotelId);
      expect(
        (
          await search({
            city: 'tokyo',
            ...stay,
            guests: 2,
            minPrice: 9000,
            maxPrice: 5000,
          })
        ).status,
      ).toBe(400);
      // Unrated hotels are excluded when a rating filter is set.
      const rated = ids(
        await search({ city: 'tokyo', ...stay, guests: 2, minRating: 1 }),
      );
      expect(rated).not.toContain(small.hotelId);
      expect(rated).not.toContain(large.hotelId);
      expect(
        (await search({ city: 'tokyo', ...stay, guests: 2, minRating: 6 }))
          .status,
      ).toBe(400);
      expect(
        (await search({ city: 'tokyo', ...stay, guests: 2, minRating: 0 }))
          .status,
      ).toBe(400);
    });

    it('HTL-15: lists the free rooms with type, beds, occupancy, price per night and total stay price', async () => {
      const res = await t
        .guest()
        .get(`/api/hotels/${large.hotelId}/rooms/available`, { query: stay });
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3);
      const room = (res.body.items as any[]).find(
        (r) => r.pricePerNight === 12000,
      );
      expect(room).toMatchObject({
        type: 'Double',
        beds: 2,
        maxOccupancy: 4,
        pricePerNight: 12000,
        totalPrice: 36000,
        nights: 3,
      });
      expect(
        (
          await t
            .guest()
            .get(`/api/hotels/${off.hotelId}/rooms/available`, { query: stay })
        ).status,
      ).toBe(404);
      expect(
        (
          await t.guest().get(`/api/hotels/${large.hotelId}/rooms/available`, {
            query: { checkIn: day(33), checkOut: day(30) },
          })
        ).status,
      ).toBe(400);
    });
  });

  describe('HTL-16 reservation (Mandatory row 48), HTL-18 hold (row 50)', () => {
    let hotel: HotelSetup;
    let roomA: { id: string };
    let roomB: { id: string };
    beforeAll(async () => {
      hotel = await hotelWithModerator(t);
      roomA = await addRoom(hotel, { maxOccupancy: 3, pricePerNight: 10000 });
      roomB = await addRoom(hotel, { maxOccupancy: 2, pricePerNight: 6500 });
    });

    it('books several rooms of one hotel for the same dates in one Pending Payment reservation held 10 minutes', async () => {
      const before = Date.now();
      const res = await book(user, hotel.hotelId, 40, 43, [
        { roomId: roomA.id, adults: 2, childrenAges: [5] },
        { roomId: roomB.id, adults: 0, childrenAges: [16, 17] },
      ]);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('pending_payment');
      // Sum over rooms of nights x that room's price: 3 x 10000 + 3 x 6500.
      expect(res.body.totalAmount).toBe(49500);
      expect(res.body.nights).toBe(3);
      expect(res.body.currency).toBe('USD');
      expect(res.body.guests).toEqual({ adults: 2, children: 3 });
      const heldFor =
        new Date(res.body.holdExpiresAt as string).getTime() - before;
      expect(heldFor).toBeGreaterThan(9.9 * 60_000);
      expect(heldFor).toBeLessThan(10.1 * 60_000);
      // Both rooms are held: neither is offered for overlapping dates.
      const free = await t
        .guest()
        .get(`/api/hotels/${hotel.hotelId}/rooms/available`, {
          query: { checkIn: day(42), checkOut: day(44) },
        });
      expect(free.body.items).toEqual([]);
    });

    it('validates guests: one adult per reservation, ages 0-17, occupancy, each room once, same hotel', async () => {
      const other = await hotelWithModerator(t);
      const foreignRoom = await addRoom(other);
      const cases: [
        string,
        { roomId: string; adults: number; childrenAges?: number[] }[],
      ][] = [
        [
          'no adult in the reservation',
          [{ roomId: roomA.id, adults: 0, childrenAges: [10] }],
        ],
        [
          'a child aged 18',
          [{ roomId: roomA.id, adults: 1, childrenAges: [18] }],
        ],
        [
          'more guests than the maximum occupancy',
          [{ roomId: roomB.id, adults: 2, childrenAges: [3] }],
        ],
        [
          'the same room twice',
          [
            { roomId: roomA.id, adults: 1 },
            { roomId: roomA.id, adults: 1 },
          ],
        ],
        [
          'a room of another hotel',
          [
            { roomId: roomA.id, adults: 1 },
            { roomId: foreignRoom.id, adults: 1 },
          ],
        ],
        ['no rooms', []],
      ];
      for (const [, rooms] of cases) {
        const res = await book(user, hotel.hotelId, 50, 52, rooms);
        expect(res.status).toBe(400);
      }
      expect(
        (
          await book(user, hotel.hotelId, 52, 52, [
            { roomId: roomA.id, adults: 1 },
          ])
        ).status,
      ).toBe(400);
      expect(
        (
          await book(user, hotel.hotelId, -1, 2, [
            { roomId: roomA.id, adults: 1 },
          ])
        ).status,
      ).toBe(400);
      expect((await t.guest().post('/api/hotel-bookings', {})).status).toBe(
        401,
      );
      expect(
        (
          await hotel.moderator.client.post('/api/hotel-bookings', {
            hotelId: hotel.hotelId,
            checkIn: day(50),
            checkOut: day(52),
            rooms: [{ roomId: roomA.id, adults: 1 }],
          })
        ).status,
      ).toBe(403);
    });

    it('if any room overlaps a hold, a Confirmed reservation or a blocked range, nothing is held', async () => {
      const h = await hotelWithModerator(t);
      const one = await addRoom(h);
      const two = await addRoom(h);
      // Room "two" is held by someone else for nights 60-61.
      const other = await t.user();
      expect(
        (await book(other, h.hotelId, 60, 62, [{ roomId: two.id, adults: 1 }]))
          .status,
      ).toBe(201);
      const both = await book(user, h.hotelId, 61, 63, [
        { roomId: one.id, adults: 1 },
        { roomId: two.id, adults: 1 },
      ]);
      expect(both.status).toBe(409);
      // Room "one" was not held by the failed request.
      const alone = await book(user, h.hotelId, 61, 63, [
        { roomId: one.id, adults: 1 },
      ]);
      expect(alone.status).toBe(201);
      // Check-out day = next check-in day is not an overlap.
      expect(
        (await book(user, h.hotelId, 62, 64, [{ roomId: two.id, adults: 1 }]))
          .status,
      ).toBe(201);
      // Blocked range.
      await h.moderator.client.patch(
        `/api/hotels/${h.hotelId}/rooms/${one.id}/availability`,
        { action: 'block', from: day(70), to: day(70) },
      );
      expect(
        (await book(user, h.hotelId, 69, 72, [{ roomId: one.id, adults: 1 }]))
          .status,
      ).toBe(409);
      expect(
        (await book(user, h.hotelId, 71, 72, [{ roomId: one.id, adults: 1 }]))
          .status,
      ).toBe(201);
    });

    it('concurrent requests for the same room and night: exactly one reservation holds it', async () => {
      const h = await hotelWithModerator(t);
      const room = await addRoom(h);
      const users = await Promise.all(
        Array.from({ length: 5 }, () => t.user()),
      );
      const results = await Promise.all(
        users.map((u) =>
          book(u, h.hotelId, 80, 82, [{ roomId: room.id, adults: 1 }]),
        ),
      );
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 409, 409, 409, 409]);
      expect(
        await t
          .collection('roomnights')
          .countDocuments({ roomId: t.oid(room.id) }),
      ).toBe(2);
    });

    it('when the hold ends without payment the reservation becomes Expired and the rooms are released', async () => {
      const h = await hotelWithModerator(t);
      const room = await addRoom(h);
      const booking = (
        await book(user, h.hotelId, 85, 87, [{ roomId: room.id, adults: 1 }])
      ).body;
      await t.service(HotelBookingLifecycleService).expireHolds();
      expect(
        (await bookingDetails(user.client, 'hotel', booking.id as string)).body
          .status,
      ).toBe('pending_payment');
      await t
        .collection('hotelbookings')
        .updateOne(
          { _id: t.oid(booking.id as string) },
          { $set: { holdExpiresAt: new Date(Date.now() - 1000) } },
        );
      await t
        .collection('roomnights')
        .updateMany(
          { bookingId: t.oid(booking.id as string) },
          { $set: { expiresAt: new Date(Date.now() - 1000) } },
        );
      await t.service(HotelBookingLifecycleService).expireHolds();
      expect(
        (await bookingDetails(user.client, 'hotel', booking.id as string)).body
          .status,
      ).toBe('expired');
      const free = await t
        .guest()
        .get(`/api/hotels/${h.hotelId}/rooms/available`, {
          query: { checkIn: day(85), checkOut: day(87) },
        });
      expect((free.body.items as any[]).map((r) => r.id)).toEqual([room.id]);
      expect(
        (await acceptPolicies(user.client, 'hotel', booking.id as string))
          .status,
      ).toBe(409);
    });
  });

  describe('HTL-05 edit room (Mandatory row 40), HTL-06 block / deactivate / delete (row 41)', () => {
    it('price changes do not affect existing reservations; availability with reservations cannot be removed', async () => {
      const h = await hotelWithModerator(t);
      const room = await addRoom(h, {
        pricePerNight: 10000,
        availableFrom: 20,
        availableTo: 40,
      });
      const booking = (
        await book(user, h.hotelId, 25, 27, [{ roomId: room.id, adults: 1 }])
      ).body;
      await payAndConfirm(t, user.client, 'hotel', booking.id as string);
      const edit = await h.moderator.client.patch(
        `/api/hotels/${h.hotelId}/rooms/${room.id}`,
        { pricePerNight: 99000, beds: 3, maxOccupancy: 4 },
      );
      expect(edit.status).toBe(200);
      expect(edit.body).toMatchObject({
        pricePerNight: 99000,
        beds: 3,
        maxOccupancy: 4,
      });
      expect(
        (await bookingDetails(user.client, 'hotel', booking.id as string)).body
          .totalAmount,
      ).toBe(20000);

      const change = (action: string, from: number, to: number) =>
        h.moderator.client.patch(
          `/api/hotels/${h.hotelId}/rooms/${room.id}/availability`,
          { action, from: day(from), to: day(to) },
        );
      // Nights 25 and 26 are reserved.
      expect((await change('remove', 24, 26)).status).toBe(409);
      expect((await change('block', 26, 30)).status).toBe(409);
      const removed = await change('remove', 27, 30);
      expect(removed.status).toBe(200);
      expect(removed.body.availableRanges).toEqual([
        { from: day(20), to: day(26) },
        { from: day(31), to: day(40) },
      ]);
      expect((await change('block', 35, 36)).status).toBe(200);
      const free = (checkIn: number, checkOut: number) =>
        t.guest().get(`/api/hotels/${h.hotelId}/rooms/available`, {
          query: { checkIn: day(checkIn), checkOut: day(checkOut) },
        });
      expect((await free(34, 36)).body.items).toEqual([]);
      expect((await change('unblock', 35, 36)).status).toBe(200);
      expect((await free(34, 36)).body.total).toBe(1);

      // Deactivation and deletion are refused while a reservation exists.
      expect(
        (
          await h.moderator.client.patch(
            `/api/hotels/${h.hotelId}/rooms/${room.id}`,
            { active: false },
          )
        ).status,
      ).toBe(409);
      expect(
        (
          await h.moderator.client.delete(
            `/api/hotels/${h.hotelId}/rooms/${room.id}`,
          )
        ).status,
      ).toBe(409);
    });

    it('a Pending Payment reservation also stops blocking, deactivation and deletion', async () => {
      const h = await hotelWithModerator(t);
      const room = await addRoom(h);
      expect(
        (await book(user, h.hotelId, 25, 27, [{ roomId: room.id, adults: 1 }]))
          .status,
      ).toBe(201);
      expect(
        (
          await h.moderator.client.patch(
            `/api/hotels/${h.hotelId}/rooms/${room.id}/availability`,
            { action: 'block', from: day(25), to: day(25) },
          )
        ).status,
      ).toBe(409);
      expect(
        (
          await h.moderator.client.patch(
            `/api/hotels/${h.hotelId}/rooms/${room.id}`,
            { active: false },
          )
        ).status,
      ).toBe(409);
      expect(
        (
          await h.moderator.client.delete(
            `/api/hotels/${h.hotelId}/rooms/${room.id}`,
          )
        ).status,
      ).toBe(409);
    });

    it('deactivated rooms are excluded from search; a room never reserved can be deleted', async () => {
      const h = await hotelWithModerator(t, {
        cityId: 'riyadh',
        countryCode: 'SA',
      });
      const room = await addRoom(h);
      const query = {
        city: 'riyadh',
        checkIn: day(20),
        checkOut: day(22),
        guests: 1,
      };
      expect(ids(await search(query))).toContain(h.hotelId);
      expect(
        (
          await h.moderator.client.patch(
            `/api/hotels/${h.hotelId}/rooms/${room.id}`,
            { active: false },
          )
        ).status,
      ).toBe(200);
      expect(ids(await search(query))).not.toContain(h.hotelId);
      expect(
        (await book(user, h.hotelId, 20, 22, [{ roomId: room.id, adults: 1 }]))
          .status,
      ).toBe(409);
      const other = await hotelWithModerator(t);
      expect(
        (
          await other.moderator.client.delete(
            `/api/hotels/${h.hotelId}/rooms/${room.id}`,
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await h.moderator.client.delete(
            `/api/hotels/${h.hotelId}/rooms/${room.id}`,
          )
        ).status,
      ).toBe(204);
      expect(
        await t.collection('rooms').countDocuments({ _id: t.oid(room.id) }),
      ).toBe(0);
    });
  });

  describe('HTL-17 confirmation (row 49), HTL-20 my reservations (row 51), HTL-21 cancel (row 52), HTL-22 (row 53), HTL-23/24 reviews (rows 54-55)', () => {
    let hotel: HotelSetup;
    let guest: Account;
    let rooms: { id: string; roomNumber: string }[];
    beforeAll(async () => {
      hotel = await hotelWithModerator(t, {
        cityId: 'paris',
        countryCode: 'FR',
      });
      await hotel.moderator.client.put(
        `/api/hotels/${hotel.hotelId}/policies`,
        {
          checkInTime: '14:00',
          checkOutTime: '12:00',
          cancellationTiers: [
            { daysBefore: 14, refundPercentage: 100 },
            { daysBefore: 3, refundPercentage: 40 },
          ],
        },
      );
      rooms = [
        await addRoom(hotel, { pricePerNight: 10000 }),
        await addRoom(hotel, { pricePerNight: 5001 }),
        await addRoom(hotel, { pricePerNight: 7000 }),
      ];
      guest = await t.user('Stay Guest');
    });

    it('PAY-02 + HTL-17: policies shown, then payment confirms all rooms with a unique reference and a notification', async () => {
      const booking = (
        await book(guest, hotel.hotelId, 20, 22, [
          { roomId: rooms[0].id, adults: 2 },
          { roomId: rooms[1].id, adults: 1 },
        ])
      ).body;
      const policies = await guest.client.get(
        `/api/bookings/hotel/${booking.id}/policies`,
      );
      expect(policies.body.policies).toMatchObject({
        checkInTime: '14:00',
        checkOutTime: '12:00',
      });
      expect(policies.body.policies.cancellationTiers).toEqual([
        { daysBefore: 14, refundPercentage: 100 },
        { daysBefore: 3, refundPercentage: 40 },
      ]);
      const blocked = await guest.client.post('/api/payments', {
        bookingType: 'hotel',
        bookingId: booking.id,
        paymentMethodId: 'pm_card_visa',
      });
      expect(blocked.status).toBe(400);

      const { booking: confirmed, payment } = await payAndConfirm(
        t,
        guest.client,
        'hotel',
        booking.id as string,
      );
      expect(confirmed.reference).toMatch(/^[A-Z0-9]{6,}$/);
      expect(confirmed.totalAmount).toBe(2 * 10000 + 2 * 5001);
      const intent = await t.stripe.paymentIntents.retrieve(
        payment.stripePaymentId as string,
      );
      expect(intent).toMatchObject({
        status: 'succeeded',
        amount: 30002,
        currency: 'usd',
      });
      const nights = await t
        .collection('roomnights')
        .find({ bookingId: t.oid(booking.id as string) })
        .toArray();
      expect(nights).toHaveLength(4);
      expect(nights.every((n) => n.status === 'booked')).toBe(true);
      const note = (await notifications(guest.client)).find((n) =>
        n.message.includes(confirmed.reference as string),
      );
      expect(note).toBeDefined();
      expect(note!.message).toContain(hotel.name);

      // HTL-20: Upcoming, with reference, hotel, rooms, dates, guests, total and status.
      const upcoming = await guest.client.get('/api/hotel-bookings', {
        query: { group: 'upcoming' },
      });
      expect(upcoming.body.items).toHaveLength(1);
      expect(upcoming.body.items[0]).toMatchObject({
        id: booking.id,
        reference: confirmed.reference,
        hotel: { id: hotel.hotelId, name: hotel.name },
        checkIn: day(20),
        checkOut: day(22),
        guests: { adults: 3, children: 0 },
        totalAmount: 30002,
        status: 'confirmed',
      });
      expect(
        (upcoming.body.items[0].rooms as any[]).map((r) => r.roomId).sort(),
      ).toEqual([rooms[0].id, rooms[1].id].sort());
      // ACC-11: nobody else can open it.
      const stranger = await t.user();
      expect(
        (await bookingDetails(stranger.client, 'hotel', booking.id as string))
          .status,
      ).toBe(404);

      // HTL-22: the hotel moderator sees guest, dates and status; other moderators do not.
      const list = await hotel.moderator.client.get(
        `/api/hotels/${hotel.hotelId}/reservations`,
      );
      expect(list.status).toBe(200);
      const row = (list.body.items as any[]).find((r) => r.id === booking.id);
      expect(row).toMatchObject({
        guest: { id: guest.id, name: 'Stay Guest' },
        checkIn: day(20),
        checkOut: day(22),
        status: 'confirmed',
      });
      const other = await hotelWithModerator(t);
      expect(
        (
          await other.moderator.client.get(
            `/api/hotels/${hotel.hotelId}/reservations`,
          )
        ).status,
      ).toBe(403);
      expect(
        (await guest.client.get(`/api/hotels/${hotel.hotelId}/reservations`))
          .status,
      ).toBe(403);

      // HTL-21: 20 days before check-in -> tier 14 -> 100% of the full total; all rooms released.
      const preview = (
        await bookingDetails(guest.client, 'hotel', booking.id as string)
      ).body.cancellation;
      expect(preview).toMatchObject({
        cancellable: true,
        refundPercentage: 100,
        tierDaysBefore: 14,
        refundAmount: 30002,
      });
      const cancelled = await guest.client.post(
        `/api/hotel-bookings/${booking.id}/cancel`,
      );
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.status).toBe('cancelled');
      expect(
        await t
          .collection('roomnights')
          .countDocuments({ bookingId: t.oid(booking.id as string) }),
      ).toBe(0);
      const refund = await t.eventually(async () => {
        const res = await bookingDetails(
          guest.client,
          'hotel',
          booking.id as string,
        );
        return res.body.refund?.status === 'refunded'
          ? res.body.refund
          : undefined;
      }, 'the hotel refund');
      expect(refund).toMatchObject({ amount: 30002, refundPercentage: 100 });
      expect(
        await t.stripe.refunds.retrieve(refund.stripeRefundId as string),
      ).toMatchObject({ amount: 30002, status: 'succeeded' });
      expect(
        (
          await guest.client.get('/api/hotel-bookings', {
            query: { group: 'cancelled' },
          })
        ).body.items.map((b: any) => b.id),
      ).toEqual([booking.id]);
      expect(
        (
          await guest.client.get('/api/hotel-bookings', {
            query: { group: 'upcoming' },
          })
        ).body.items,
      ).toEqual([]);
    });

    it('HTL-21: the refund follows the tiers on the full total; on the check-in date cancellation is blocked', async () => {
      // 5 days before check-in: tier 3 -> 40% of 2 x 7000 = 5600.
      const booking = (
        await book(guest, hotel.hotelId, 5, 7, [
          { roomId: rooms[2].id, adults: 1 },
        ])
      ).body;
      await payAndConfirm(t, guest.client, 'hotel', booking.id as string);
      const preview = (
        await bookingDetails(guest.client, 'hotel', booking.id as string)
      ).body.cancellation;
      expect(preview).toMatchObject({
        refundPercentage: 40,
        tierDaysBefore: 3,
        refundAmount: 5600,
      });
      // The check-in date arrives.
      const today = new Date(`${day(0)}T00:00:00.000Z`);
      await t
        .collection('hotelbookings')
        .updateOne(
          { _id: t.oid(booking.id as string) },
          { $set: { checkIn: today } },
        );
      const late = await guest.client.post(
        `/api/hotel-bookings/${booking.id}/cancel`,
      );
      expect(late.status).toBe(409);
      expect(
        (await bookingDetails(guest.client, 'hotel', booking.id as string)).body
          .status,
      ).toBe('confirmed');
      // One day before check-in: no tier applies -> 0%, no refund.
      await t
        .collection('hotelbookings')
        .updateOne(
          { _id: t.oid(booking.id as string) },
          { $set: { checkIn: new Date(`${day(1)}T00:00:00.000Z`) } },
        );
      const zero = await guest.client.post(
        `/api/hotel-bookings/${booking.id}/cancel`,
      );
      expect(zero.status).toBe(200);
      expect(zero.body.refund).toBeNull();
    });

    it('HTL-23/24: a Confirmed reservation becomes Completed after check-out; one rating per reservation; the average is recalculated', async () => {
      const reviewOf = async (
        account: Account,
        roomIndex: number,
        rating: number,
        text?: string,
      ) => {
        const booking = (
          await book(account, hotel.hotelId, 9, 11, [
            { roomId: rooms[roomIndex].id, adults: 1 },
          ])
        ).body;
        await payAndConfirm(t, account.client, 'hotel', booking.id as string);
        // Not Completed yet: no review.
        const early = await account.client.post(
          `/api/hotel-bookings/${booking.id}/review`,
          { rating },
        );
        expect(early.status).toBe(409);
        // The check-out date is today: still Confirmed. Yesterday: Completed.
        const at = (offset: number) => new Date(`${day(offset)}T00:00:00.000Z`);
        await t
          .collection('hotelbookings')
          .updateOne(
            { _id: t.oid(booking.id as string) },
            { $set: { checkIn: at(-3), checkOut: at(0) } },
          );
        await t.service(HotelBookingLifecycleService).completeStays();
        expect(
          (await bookingDetails(account.client, 'hotel', booking.id as string))
            .body.status,
        ).toBe('confirmed');
        await t
          .collection('hotelbookings')
          .updateOne(
            { _id: t.oid(booking.id as string) },
            { $set: { checkIn: at(-3), checkOut: at(-1) } },
          );
        await t
          .collection('roomnights')
          .deleteMany({ bookingId: t.oid(booking.id as string) });
        await t.service(HotelBookingLifecycleService).completeStays();
        expect(
          (await bookingDetails(account.client, 'hotel', booking.id as string))
            .body.status,
        ).toBe('completed');
        const res = await account.client.post(
          `/api/hotel-bookings/${booking.id}/review`,
          { rating, ...(text ? { text } : {}) },
        );
        return { bookingId: booking.id as string, res };
      };
      const second = await t.user('Second Reviewer');
      const first = await reviewOf(guest, 0, 5, 'Lovely stay');
      expect(first.res.status).toBe(201);
      expect(first.res.body).toMatchObject({
        rating: 5,
        text: 'Lovely stay',
        author: { name: 'Stay Guest' },
      });
      // One rating per reservation.
      expect(
        (
          await guest.client.post(
            `/api/hotel-bookings/${first.bookingId}/review`,
            { rating: 1 },
          )
        ).status,
      ).toBe(409);
      const other = await reviewOf(second, 1, 2);
      expect(other.res.status).toBe(201);

      // GEN-09: a review can be reported like a post, comment or itinerary, once per user, and
      // the admin sees the report.
      const reported = await second.client.post('/api/reports', {
        contentType: 'review',
        contentId: first.res.body.id,
        reason: 'Fake review',
      });
      expect(reported.status).toBe(201);
      expect(reported.body).toMatchObject({
        contentType: 'review',
        contentId: first.res.body.id,
        reason: 'Fake review',
        status: 'open',
      });
      expect(
        (
          await second.client.post('/api/reports', {
            contentType: 'review',
            contentId: first.res.body.id,
            reason: 'Again',
          })
        ).status,
      ).toBe(409);
      const openReports = await (
        await t.admin()
      ).get('/api/admin/reports', { query: { status: 'open' } });
      expect(
        (openReports.body.items as any[]).some(
          (r) => r.id === reported.body.id && r.contentType === 'review',
        ),
      ).toBe(true);

      // HTL-24: average, number of ratings, reviews newest first.
      let page = await t.guest().get(`/api/hotels/${hotel.hotelId}/reviews`);
      expect(page.status).toBe(200);
      expect(page.body).toMatchObject({
        averageRating: 3.5,
        ratingCount: 2,
        total: 2,
      });
      expect((page.body.items as any[]).map((r) => r.rating)).toEqual([2, 5]);
      expect(
        (await t.guest().get(`/api/hotels/${hotel.hotelId}`)).body,
      ).toMatchObject({ averageRating: 3.5, ratingCount: 2 });
      // HTL-12: the rating filter and the rating sort use it.
      const query = {
        city: 'paris',
        checkIn: day(30),
        checkOut: day(31),
        guests: 1,
      };
      expect(ids(await search({ ...query, minRating: 3.5 }))).toContain(
        hotel.hotelId,
      );
      expect(ids(await search({ ...query, minRating: 4 }))).not.toContain(
        hotel.hotelId,
      );

      // Validation: rating 1-5, text up to 1000 characters; only the owner of the reservation.
      const reviewId = first.res.body.id as string;
      expect(
        (await guest.client.patch(`/api/reviews/${reviewId}`, { rating: 6 }))
          .status,
      ).toBe(400);
      expect(
        (await guest.client.patch(`/api/reviews/${reviewId}`, { rating: 0 }))
          .status,
      ).toBe(400);
      expect(
        (
          await guest.client.patch(`/api/reviews/${reviewId}`, {
            text: 'x'.repeat(1001),
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await guest.client.patch(`/api/reviews/${reviewId}`, {
            text: 'x'.repeat(1000),
          })
        ).status,
      ).toBe(200);
      expect(
        (await second.client.patch(`/api/reviews/${reviewId}`, { rating: 1 }))
          .status,
      ).toBe(403);
      expect(
        (await second.client.delete(`/api/reviews/${reviewId}`)).status,
      ).toBe(403);
      expect(
        (
          await second.client.post(
            `/api/hotel-bookings/${first.bookingId}/review`,
            { rating: 3 },
          )
        ).status,
      ).toBe(404);

      // Edit: 5 -> 3 gives (3 + 2) / 2 = 2.5. Delete: only the other rating (2) remains.
      expect(
        (await guest.client.patch(`/api/reviews/${reviewId}`, { rating: 3 }))
          .status,
      ).toBe(200);
      page = await t.guest().get(`/api/hotels/${hotel.hotelId}/reviews`);
      expect(page.body).toMatchObject({ averageRating: 2.5, ratingCount: 2 });
      expect(
        (await guest.client.delete(`/api/reviews/${reviewId}`)).status,
      ).toBe(204);
      page = await t.guest().get(`/api/hotels/${hotel.hotelId}/reviews`);
      expect(page.body).toMatchObject({
        averageRating: 2,
        ratingCount: 1,
        total: 1,
      });

      // HTL-20: completed stays are listed under Past.
      const past = await guest.client.get('/api/hotel-bookings', {
        query: { group: 'past' },
      });
      expect(
        (past.body.items as any[]).map((b) => [b.id, b.status]),
      ).toContainEqual([first.bookingId, 'completed']);
    });
  });
});
