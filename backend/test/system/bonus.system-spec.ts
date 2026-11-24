// System tests: the optional (bonus) requirements, sheet "Bonus" of the Excel file (row in
// brackets) and the endpoints marked Optional in the project description section 8.
// Emails are really sent through the SMTP test inbox configured in backend/.env (GEN-01-B); the
// tests read the link from the message the application hands to its mail service.
import { HotelBookingLifecycleService } from '../../src/hotel-bookings/hotel-booking-lifecycle.service';
import { MailService } from '../../src/mail/mail.service';
import { Account, PASSWORD, TestApp, day, unique } from '../support/harness';
import {
  addRoom,
  adult,
  airlineWithModerator,
  bookableFlight,
  bookingDetails,
  hotelWithModerator,
  payAndConfirm,
} from '../support/scenarios';

describe('Bonus requirements', () => {
  const t = new TestApp();
  const sent: { to: string; subject: string; text: string }[] = [];
  beforeAll(async () => {
    // ACC-02: with this setting a new account cannot book until its email is verified.
    process.env.REQUIRE_EMAIL_VERIFICATION = 'true';
    await t.start();
    const mail = t.service(MailService);
    const original = mail.sendMail.bind(mail);
    jest.spyOn(mail, 'sendMail').mockImplementation(async (message) => {
      sent.push(message);
      return original(message);
    });
  });
  afterAll(async () => {
    delete process.env.REQUIRE_EMAIL_VERIFICATION;
    await t.stop();
  });

  const lastMail = (to: string, subject: RegExp) =>
    t.eventually(
      () =>
        Promise.resolve(
          [...sent]
            .reverse()
            .find((m) => m.to === to && subject.test(m.subject)),
        ),
      `an email "${subject}" to ${to}`,
      15_000,
    );
  const verify = async (account: Account) => {
    const mail = await lastMail(account.email, /verify/i);
    const token = /token=([\w-]+)/.exec(mail.text)![1];
    return t.guest().get('/api/auth/verify-email', { query: { token } });
  };
  const verifiedUser = async (name?: string) => {
    const account = await t.user(name);
    const res = await verify(account);
    if (res.status !== 200) throw new Error(res.text);
    return account;
  };

  describe('ACC-02 email verification (Bonus row 2)', () => {
    it('sends a verification link after registration and blocks booking until the email is verified', async () => {
      const airline = await airlineWithModerator(t);
      const flight = await bookableFlight(airline, { inDays: 30 });
      const account = await t.user();
      const body = {
        segments: [{ flightId: flight.id, cabinClass: 'economy' }],
        passengers: [adult()],
      };
      expect(
        (await account.client.get('/api/auth/me')).body.emailVerified,
      ).toBe(false);
      const blocked = await account.client.post(
        '/api/flight-bookings/hold',
        body,
      );
      expect(blocked.status).toBe(403);
      expect(blocked.body.message).toMatch(/verify/i);

      const mail = await lastMail(account.email, /verify/i);
      // B4 (team leader, 17 Nov 2026): the link opens the frontend page /verify-email (P-08), which
      // calls GET /api/auth/verify-email itself, like the ACC-07 reset link opens /reset-password.
      expect(mail.text).toContain('/verify-email?token=');
      expect(mail.text).not.toContain('/api/auth/verify-email');
      expect(
        (
          await t
            .guest()
            .get('/api/auth/verify-email', { query: { token: 'wrong-token' } })
        ).status,
      ).toBe(400);
      expect((await verify(account)).status).toBe(200);
      expect(
        (await account.client.get('/api/auth/me')).body.emailVerified,
      ).toBe(true);
      expect(
        (await account.client.post('/api/flight-bookings/hold', body)).status,
      ).toBe(201);
      // The link works once.
      expect((await verify(account)).status).toBe(400);
    });
  });

  describe('ACC-07 forgotten password (Bonus row 3)', () => {
    const tokenOf = async (email: string) =>
      /token=([\w-]+)/.exec((await lastMail(email, /reset/i)).text)![1];

    it('the reset link is single-use, is replaced by a newer request and never reveals whether the email exists', async () => {
      const account = await t.user();
      const known = await t
        .guest()
        .post('/api/auth/forgot-password', { email: account.email });
      const unknown = await t.guest().post('/api/auth/forgot-password', {
        email: `${unique('ghost')}@example.com`,
      });
      expect(known.status).toBe(200);
      expect(unknown.status).toBe(200);
      expect(unknown.body).toEqual(known.body);
      const first = await tokenOf(account.email);

      // A newer request invalidates the older link.
      const before = sent.length;
      await t
        .guest()
        .post('/api/auth/forgot-password', { email: account.email });
      await t.eventually(
        () => Promise.resolve(sent.length > before),
        'the second reset email',
        15_000,
      );
      const second = await tokenOf(account.email);
      expect(second).not.toBe(first);
      expect(
        (
          await t.guest().post('/api/auth/reset-password', {
            token: first,
            newPassword: 'Brandnew1',
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await t.guest().post('/api/auth/reset-password', {
            token: second,
            newPassword: 'weak',
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await t.guest().post('/api/auth/reset-password', {
            token: second,
            newPassword: 'Brandnew1',
          })
        ).status,
      ).toBe(200);
      // Single-use.
      expect(
        (
          await t.guest().post('/api/auth/reset-password', {
            token: second,
            newPassword: 'Another12',
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await t.guest().post('/api/auth/login', {
            email: account.email,
            password: PASSWORD,
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await t.guest().post('/api/auth/login', {
            email: account.email,
            password: 'Brandnew1',
          })
        ).status,
      ).toBe(200);
    });

    it('the link expires after 30 minutes', async () => {
      const account = await t.user();
      const startedAt = Date.now();
      await t
        .guest()
        .post('/api/auth/forgot-password', { email: account.email });
      const token = await tokenOf(account.email);
      const stored = await t.collection('emailtokens').findOne({
        userId: t.oid(account.id),
        purpose: 'reset_password',
        usedAt: null,
      });
      const lifetime =
        new Date(stored!.expiresAt as Date).getTime() - startedAt;
      expect(lifetime).toBeGreaterThan(29.5 * 60_000);
      expect(lifetime).toBeLessThan(30.5 * 60_000);
      await t
        .collection('emailtokens')
        .updateOne(
          { _id: stored!._id },
          { $set: { expiresAt: new Date(Date.now() - 1000) } },
        );
      expect(
        (
          await t.guest().post('/api/auth/reset-password', {
            token,
            newPassword: 'Brandnew1',
          })
        ).status,
      ).toBe(400);
    });
  });

  describe('GEN-01-B email notifications (Bonus row 4)', () => {
    it('the in-app notifications and the moderator invitation are also sent by email', async () => {
      const admin = await t.admin();
      const account = await t.user();
      await admin.patch(`/api/admin/accounts/${account.id}/suspend`, {
        reason: 'Email check',
      });
      const suspension = await lastMail(account.email, /suspend/i);
      expect(suspension.text).toContain('Email check');
      const airline = await t.airline();
      const email = `${unique('invite')}@example.com`;
      await admin.post('/api/admin/moderators', {
        name: 'Invited',
        email,
        role: 'airline_moderator',
        providerId: airline.id,
        temporaryPassword: 'Temp0rary!x',
      });
      const invitation = await lastMail(email, /invited/i);
      expect(invitation.text).toContain('Temp0rary!x');
    });
  });

  describe('FLT-27 change flight (Bonus row 5), FLT-28 seat selection (row 6)', () => {
    it('changes a Confirmed booking to another flight on the same route and cabin: a lower fare is refunded, a higher one is paid', async () => {
      const airline = await airlineWithModerator(t);
      const original = await bookableFlight(
        airline,
        { inDays: 40 },
        { price: 20000, seats: 3 },
      );
      const cheaper = await bookableFlight(
        airline,
        { inDays: 41 },
        { price: 15000, seats: 3 },
      );
      const dearer = await bookableFlight(
        airline,
        { inDays: 42 },
        { price: 26000, seats: 3 },
      );
      const full = await bookableFlight(
        airline,
        { inDays: 43 },
        { price: 20000, seats: 1 },
      );
      const otherRoute = await bookableFlight(airline, {
        from: 'DXB',
        to: 'CAI',
        inDays: 44,
        arrivalTime: '13:00',
      });
      const account = await verifiedUser();
      const held = await account.client.post('/api/flight-bookings/hold', {
        segments: [{ flightId: original.id, cabinClass: 'economy' }],
        passengers: [adult('A'), adult('B')],
      });
      await payAndConfirm(t, account.client, 'flight', held.body.id as string);
      const change = (newFlightId: string, paymentMethodId?: string) =>
        account.client.patch(
          `/api/flight-bookings/${held.body.id}/change-flight`,
          {
            segment: 'outbound',
            newFlightId,
            ...(paymentMethodId ? { paymentMethodId } : {}),
          },
        );
      const remaining = async (id: string) =>
        (await t.guest().get(`/api/flights/${id}`)).body.cabins[0]
          .seatsRemaining as number;

      expect((await change(otherRoute.id)).status).toBe(400);
      // Subject to seat availability: 2 seats needed, 1 left.
      expect((await change(full.id)).status).toBe(409);
      expect(await remaining(original.id)).toBe(1);

      const lower = await change(cheaper.id);
      expect(lower.status).toBe(200);
      expect(lower.body.fareChange).toMatchObject({
        direction: 'refunded',
        amount: 10000,
        previousTotal: 40000,
        newTotal: 30000,
      });
      expect(lower.body.segments[0].flightId).toBe(cheaper.id);
      expect(await remaining(original.id)).toBe(3);
      expect(await remaining(cheaper.id)).toBe(1);
      const refunds = await t.eventually(async () => {
        const rows = await t
          .collection('fare_change_refunds')
          .find({ bookingId: t.oid(held.body.id as string), state: 'refunded' })
          .toArray();
        return rows.length > 0 ? rows : undefined;
      }, 'the fare difference refund');
      expect(
        await t.stripe.refunds.retrieve(refunds[0].stripeRefundId as string),
      ).toMatchObject({ amount: 10000, status: 'succeeded' });

      // A higher fare needs a payment.
      expect((await change(dearer.id)).status).toBe(400);
      const declined = await change(dearer.id, 'pm_card_chargeDeclined');
      expect(declined.status).toBe(402);
      expect(
        (await bookingDetails(account.client, 'flight', held.body.id as string))
          .body.segments[0].flightId,
      ).toBe(cheaper.id);
      const higher = await change(dearer.id, 'pm_card_visa');
      expect(higher.status).toBe(200);
      expect(higher.body.fareChange).toMatchObject({
        direction: 'charged',
        amount: 22000,
        newTotal: 52000,
      });
      expect(await remaining(dearer.id)).toBe(1);
      expect(await remaining(cheaper.id)).toBe(3);
    });

    it('a passenger selects a free seat of the cabin; a taken seat is refused', async () => {
      const airline = await airlineWithModerator(t);
      const flight = await bookableFlight(
        airline,
        { inDays: 45 },
        { seats: 12 },
      );
      const one = await verifiedUser();
      const two = await verifiedUser();
      const bookingOf = async (account: Account) => {
        const held = await account.client.post('/api/flight-bookings/hold', {
          segments: [{ flightId: flight.id, cabinClass: 'economy' }],
          passengers: [adult()],
        });
        await payAndConfirm(
          t,
          account.client,
          'flight',
          held.body.id as string,
        );
        return held.body.id as string;
      };
      const first = await bookingOf(one);
      const second = await bookingOf(two);
      const pick = (account: Account, id: string, seatNumber: string) =>
        account.client.patch(`/api/flight-bookings/${id}/seat`, {
          passengerIndex: 0,
          seatNumber,
        });
      const picked = await pick(one, first, '1A');
      expect(picked.status).toBe(200);
      expect(picked.body.seatAssignments).toEqual([
        expect.objectContaining({
          passengerIndex: 0,
          seatNumber: '1A',
          flightNumber: flight.flightNumber,
        }),
      ]);
      expect((await pick(two, second, '1A')).status).toBe(409);
      // 12 seats, 6 per row: rows 1-2.
      expect((await pick(two, second, '3A')).status).toBe(400);
      expect((await pick(two, second, '2F')).status).toBe(200);
      expect((await pick(two, first, '2A')).status).toBe(404);
      expect(
        (await bookingDetails(two.client, 'flight', second)).body
          .seatAssignments[0].seatNumber,
      ).toBe('2F');
    });
  });

  describe('HTL-26 reply to a review (Bonus row 7)', () => {
    it('the hotel moderator replies once to a review of the own hotel', async () => {
      const hotel = await hotelWithModerator(t);
      const other = await hotelWithModerator(t);
      const room = await addRoom(hotel);
      const guest = await verifiedUser('Reviewing Guest');
      const booking = await guest.client.post('/api/hotel-bookings', {
        hotelId: hotel.hotelId,
        checkIn: day(5),
        checkOut: day(6),
        rooms: [{ roomId: room.id, adults: 1 }],
      });
      await payAndConfirm(t, guest.client, 'hotel', booking.body.id as string);
      const at = (offset: number) => new Date(`${day(offset)}T00:00:00.000Z`);
      await t
        .collection('hotelbookings')
        .updateOne(
          { _id: t.oid(booking.body.id as string) },
          { $set: { checkIn: at(-3), checkOut: at(-1) } },
        );
      await t.service(HotelBookingLifecycleService).completeStays();
      const review = await guest.client.post(
        `/api/hotel-bookings/${booking.body.id}/review`,
        { rating: 4, text: 'Good' },
      );
      expect(review.status).toBe(201);
      const path = `/api/reviews/${review.body.id}/reply`;
      expect(
        (await other.moderator.client.post(path, { text: 'Not mine' })).status,
      ).toBe(403);
      expect((await guest.client.post(path, { text: 'Me?' })).status).toBe(403);
      expect(
        (await hotel.moderator.client.post(path, { text: '' })).status,
      ).toBe(400);
      const reply = await hotel.moderator.client.post(path, {
        text: 'Thank you!',
      });
      expect(reply.status).toBe(201);
      expect(reply.body.reply.text).toBe('Thank you!');
      expect(
        (await hotel.moderator.client.post(path, { text: 'Again' })).status,
      ).toBe(409);
      const listed = await t
        .guest()
        .get(`/api/hotels/${hotel.hotelId}/reviews`);
      expect(listed.body.items[0].reply.text).toBe('Thank you!');
    });
  });

  describe('ITN-27 link bookings (Bonus row 8), ITN-28 PDF (row 9), BLG-13 attach itinerary (row 10)', () => {
    it('a Confirmed booking is linked to an itinerary day and feeds the budget; the itinerary exports as PDF; it can be attached to a post', async () => {
      const airline = await airlineWithModerator(t);
      const flight = await bookableFlight(
        airline,
        { inDays: 46 },
        { price: 12345 },
      );
      const account = await verifiedUser();
      const stranger = await verifiedUser();
      const trip = await account.client.post('/api/itineraries', {
        title: 'Linked trip',
        countryCodes: ['AE'],
        startDate: day(46),
      });
      const tripDay = await account.client.post(
        `/api/itineraries/${trip.body.id}/days`,
        { cityId: 'dubai' },
      );
      await account.client.post(
        `/api/itineraries/${trip.body.id}/days/${tripDay.body.id}/budgets`,
        { category: 'food', amount: 50, currency: 'USD' },
      );
      const held = await account.client.post('/api/flight-bookings/hold', {
        segments: [{ flightId: flight.id, cabinClass: 'economy' }],
        passengers: [adult()],
      });
      const link = () =>
        account.client.post(`/api/itineraries/${trip.body.id}/bookings`, {
          bookingType: 'flight',
          bookingId: held.body.id,
          dayId: tripDay.body.id,
        });
      // Only booked (Confirmed) flights can be linked.
      expect((await link()).status).toBe(409);
      const { booking } = await payAndConfirm(
        t,
        account.client,
        'flight',
        held.body.id as string,
      );
      const linked = await link();
      expect(linked.status).toBe(201);
      expect(linked.body).toMatchObject({
        bookingType: 'flight',
        bookingId: held.body.id,
        dayId: tripDay.body.id,
        reference: booking.reference,
        amount: 123.45,
        currency: 'USD',
      });
      expect((await link()).status).toBe(409);
      expect(
        (
          await stranger.client.post(
            `/api/itineraries/${trip.body.id}/bookings`,
            {
              bookingType: 'flight',
              bookingId: held.body.id,
              dayId: tripDay.body.id,
            },
          )
        ).status,
      ).toBe(404);
      const budget = await account.client.get(
        `/api/itineraries/${trip.body.id}/budget-summary`,
        { query: { currency: 'USD' } },
      );
      expect(budget.body.grandTotal).toEqual({ USD: 50 });
      expect(budget.body.linkedBookings.total).toEqual({ USD: 123.45 });
      expect(budget.body.grandTotalWithBookings).toEqual({ USD: 173.45 });

      const pdf = await account.client.get(
        `/api/itineraries/${trip.body.id}/pdf`,
      );
      expect(pdf.status).toBe(200);
      expect(pdf.headers['content-type']).toContain('application/pdf');
      expect(pdf.buffer.subarray(0, 5).toString()).toBe('%PDF-');
      expect(
        (await stranger.client.get(`/api/itineraries/${trip.body.id}/pdf`))
          .status,
      ).toBe(404);

      const post = await account.client.post('/api/posts', {
        title: 'With a plan',
        body: 'See my itinerary',
        status: 'published',
      });
      const attach = (
        client = account.client,
        itineraryId: string | null = trip.body.id as string,
      ) =>
        client.patch(`/api/posts/${post.body.id}/itinerary`, { itineraryId });
      expect((await attach(stranger.client)).status).toBe(403);
      const attached = await attach();
      expect(attached.status).toBe(200);
      expect(attached.body).toEqual({
        id: post.body.id,
        itineraryId: trip.body.id,
      });
      expect((await attach(account.client, null)).body.itineraryId).toBeNull();
    });
  });

  describe('BON-01 analytics (Bonus row 11), BON-02 favourites (row 12)', () => {
    it('the admin sees bookings and revenue per provider over a selected period', async () => {
      const admin = await t.admin();
      const hotel = await hotelWithModerator(t);
      const room = await addRoom(hotel, { pricePerNight: 8000 });
      const account = await verifiedUser();
      const booking = await account.client.post('/api/hotel-bookings', {
        hotelId: hotel.hotelId,
        checkIn: day(10),
        checkOut: day(12),
        rooms: [{ roomId: room.id, adults: 1 }],
      });
      await payAndConfirm(
        t,
        account.client,
        'hotel',
        booking.body.id as string,
      );
      await account.client.post('/api/hotel-bookings', {
        hotelId: hotel.hotelId,
        checkIn: day(20),
        checkOut: day(21),
        rooms: [{ roomId: room.id, adults: 1 }],
      });
      const res = await admin.get('/api/admin/analytics', {
        query: { providerId: hotel.hotelId, from: day(0), to: day(0) },
      });
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      // One Confirmed reservation of 2 nights; the unpaid one brings no revenue.
      expect(res.body.items[0]).toMatchObject({
        providerId: hotel.hotelId,
        providerType: 'hotel',
        totalBookings: 2,
        confirmedBookings: 1,
        pendingBookings: 1,
        totalRevenue: 16000,
        currency: 'USD',
      });
      const earlier = await admin.get('/api/admin/analytics', {
        query: { providerId: hotel.hotelId, from: day(-10), to: day(-1) },
      });
      expect(earlier.body.items[0]).toMatchObject({
        totalBookings: 0,
        totalRevenue: 0,
      });
      expect((await account.client.get('/api/admin/analytics')).status).toBe(
        403,
      );
    });

    it('a user saves hotels and public itineraries to a favourites list and views it', async () => {
      const hotel = await hotelWithModerator(t);
      const owner = await verifiedUser();
      const account = await verifiedUser();
      const shared = await owner.client.post('/api/itineraries', {
        title: 'Shared plan',
        countryCodes: ['EG'],
        startDate: day(30),
      });
      const secret = await owner.client.post('/api/itineraries', {
        title: 'Secret plan',
        countryCodes: ['EG'],
        startDate: day(30),
      });
      await owner.client.patch(`/api/itineraries/${shared.body.id}`, {
        visibility: 'public',
      });
      const add = (type: string, targetId: string) =>
        account.client.post('/api/favourites', { type, targetId });
      const savedHotel = await add('hotel', hotel.hotelId);
      expect(savedHotel.status).toBe(201);
      expect(savedHotel.body).toMatchObject({
        type: 'hotel',
        targetId: hotel.hotelId,
        item: { name: hotel.name },
      });
      expect((await add('itinerary', shared.body.id as string)).status).toBe(
        201,
      );
      expect((await add('itinerary', secret.body.id as string)).status).toBe(
        404,
      );
      expect((await add('flight', hotel.hotelId)).status).toBe(400);
      const list = await account.client.get('/api/favourites');
      expect((list.body.items as any[]).map((f) => f.targetId).sort()).toEqual(
        [hotel.hotelId, shared.body.id].sort(),
      );
      expect(
        (
          await account.client.get('/api/favourites', {
            query: { type: 'hotel' },
          })
        ).body.total,
      ).toBe(1);
      // Private to the user.
      expect((await owner.client.get('/api/favourites')).body.total).toBe(0);
      expect(
        (await owner.client.delete(`/api/favourites/${savedHotel.body.id}`))
          .status,
      ).toBe(404);
      expect(
        (await account.client.delete(`/api/favourites/${savedHotel.body.id}`))
          .status,
      ).toBe(204);
      expect((await account.client.get('/api/favourites')).body.total).toBe(1);
      expect((await t.guest().get('/api/favourites')).status).toBe(401);
    });
  });
});
