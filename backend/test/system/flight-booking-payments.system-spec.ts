// System tests: flight booking, payment with Stripe (test mode), cancellation and refunds.
// Stripe is real: PaymentIntents and Refunds are created in the Stripe test account and the
// webhook events arrive through the Stripe CLI (see test/support/global-setup.ts).
// Expected results come from the Excel sheet "Mandatory" (row in brackets) and the project
// description sections 6.4, 8.4 and 8.7.
import { FlightBookingLifecycleService } from '../../src/flight-bookings/flight-booking-lifecycle.service';
import { Account, TestApp, day } from '../support/harness';
import {
  AirlineSetup,
  acceptPolicies,
  adult,
  airlineWithModerator,
  bookableFlight,
  bookingDetails,
  notifications,
  payAndConfirm,
  seatsRemaining,
} from '../support/scenarios';

describe('Flight booking, payment and refunds', () => {
  const t = new TestApp();
  let airline: AirlineSetup;
  let user: Account;

  beforeAll(async () => {
    await t.start();
    airline = await airlineWithModerator(t);
    // FLT-09 tiers and FLT-08 extra baggage of this airline.
    await airline.moderator.client.put(
      `/api/airlines/${airline.airlineId}/cancellation-policy`,
      {
        tiers: [
          { daysBefore: 30, refundPercentage: 100 },
          { daysBefore: 7, refundPercentage: 50 },
          { daysBefore: 2, refundPercentage: 10 },
        ],
      },
    );
    await airline.moderator.client.put(
      `/api/airlines/${airline.airlineId}/baggage-policy`,
      { extraBagPrice: 3000, maxExtraBagsPerPassenger: 2 },
    );
    user = await t.user('Booker One');
  });
  afterAll(() => t.stop());

  const request = (flightId: string, passengers: unknown[] = [adult()]) => ({
    segments: [{ flightId, cabinClass: 'economy' }],
    passengers,
  });
  const hold = (account: Account, flightId: string, passengers?: unknown[]) =>
    account.client.post(
      '/api/flight-bookings/hold',
      request(flightId, passengers),
    );
  const stored = (bookingId: string) =>
    t.collection('flightbookings').findOne({ _id: t.oid(bookingId) });

  describe('FLT-19 passengers and baggage, FLT-21 summary (Mandatory rows 29-30)', () => {
    it('the summary shows flight, passengers, baggage and the total with the baggage fee', async () => {
      const flight = await bookableFlight(
        airline,
        { inDays: 45 },
        { price: 20000 },
      );
      const res = await user.client.post(
        '/api/flight-bookings',
        request(flight.id, [
          adult('Mona Adel', [{ weightKg: 20 }, { weightKg: 23 }]),
          {
            type: 'child',
            fullName: 'Kid Adel',
            dateOfBirth: `${new Date().getUTCFullYear() - 6}-01-15`,
            passportNumber: 'C123',
          },
          {
            type: 'infant',
            fullName: 'Baby Adel',
            dateOfBirth: day(-200),
            passportNumber: 'I123',
          },
        ]),
      );
      expect(res.status).toBe(200);
      expect(res.body.segments[0]).toMatchObject({
        flightId: flight.id,
        flightNumber: flight.flightNumber,
        cabinClass: 'economy',
        fare: 20000,
      });
      expect(
        (res.body.passengers as any[]).map((p) => [
          p.fullName,
          p.type,
          p.fare,
          p.baggageFee,
        ]),
      ).toEqual([
        ['Mona Adel', 'adult', 20000, 6000],
        ['Kid Adel', 'child', 20000, 0],
        ['Baby Adel', 'infant', 2000, 0],
      ]);
      expect(res.body.passengers[0].extraBags).toEqual([
        { weightKg: 20 },
        { weightKg: 23 },
      ]);
      expect(res.body.seats).toBe(2);
      expect(res.body.totalAmount).toBe(20000 + 6000 + 20000 + 2000);
      expect(res.body.currency).toBe('USD');
      // The summary reserves nothing.
      expect(await seatsRemaining(t, flight.id)).toBe(10);
    });

    it('validates each passenger: full name, date of birth, passport/ID number', async () => {
      const flight = await bookableFlight(airline, { inDays: 45 });
      for (const broken of [
        { ...adult(), fullName: '' },
        { ...adult(), dateOfBirth: 'yesterday' },
        { ...adult(), passportNumber: '' },
        { ...adult(), type: 'senior' },
      ]) {
        const res = await user.client.post(
          '/api/flight-bookings',
          request(flight.id, [broken]),
        );
        expect(res.status).toBe(400);
      }
    });

    it('FLT-12: the passenger type is validated against the date of birth', async () => {
      const flight = await bookableFlight(airline, { inDays: 45 });
      const year = new Date().getUTCFullYear();
      const tooOldForChild = await user.client.post(
        '/api/flight-bookings',
        request(flight.id, [
          adult(),
          {
            type: 'child',
            fullName: 'Teen',
            dateOfBirth: `${year - 14}-01-01`,
            passportNumber: 'T1',
          },
        ]),
      );
      expect(tooOldForChild.status).toBe(400);
      const tooOldForInfant = await user.client.post(
        '/api/flight-bookings',
        request(flight.id, [
          adult(),
          {
            type: 'infant',
            fullName: 'Kid',
            dateOfBirth: `${year - 4}-01-01`,
            passportNumber: 'T2',
          },
        ]),
      );
      expect(tooOldForInfant.status).toBe(400);
      const tooYoungForAdult = await user.client.post(
        '/api/flight-bookings',
        request(flight.id, [
          {
            type: 'adult',
            fullName: 'Kid',
            dateOfBirth: `${year - 8}-01-01`,
            passportNumber: 'T3',
          },
        ]),
      );
      expect(tooYoungForAdult.status).toBe(400);
    });

    it('FLT-12: needs one adult and no more infants than adults', async () => {
      const flight = await bookableFlight(airline, { inDays: 45 });
      const infant = (n: number) => ({
        type: 'infant',
        fullName: `Baby ${n}`,
        dateOfBirth: day(-100 - n),
        passportNumber: `B${n}`,
      });
      const child = {
        type: 'child',
        fullName: 'Kid',
        dateOfBirth: `${new Date().getUTCFullYear() - 6}-01-15`,
        passportNumber: 'K1',
      };
      expect(
        (
          await user.client.post(
            '/api/flight-bookings',
            request(flight.id, [child]),
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await user.client.post(
            '/api/flight-bookings',
            request(flight.id, [adult(), infant(1), infant(2)]),
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await user.client.post(
            '/api/flight-bookings',
            request(flight.id, [adult(), infant(1)]),
          )
        ).status,
      ).toBe(200);
    });

    it("FLT-19, FLT-08: extra bags only up to the airline's maximum and the cabin's bag weight", async () => {
      const flight = await bookableFlight(
        airline,
        { inDays: 45 },
        { maxBagWeightKg: 23 },
      );
      const three = await user.client.post(
        '/api/flight-bookings',
        request(flight.id, [
          adult('A', [{ weightKg: 10 }, { weightKg: 10 }, { weightKg: 10 }]),
        ]),
      );
      expect(three.status).toBe(400);
      const heavy = await user.client.post(
        '/api/flight-bookings',
        request(flight.id, [adult('A', [{ weightKg: 23.5 }])]),
      );
      expect(heavy.status).toBe(400);
      const ok = await user.client.post(
        '/api/flight-bookings',
        request(flight.id, [adult('A', [{ weightKg: 23 }])]),
      );
      expect(ok.status).toBe(200);
      expect(ok.body.totalAmount).toBe(20000 + 3000);
    });

    it('booking is for registered users: guests get 401, admins and moderators 403 (ACC-10)', async () => {
      const flight = await bookableFlight(airline, { inDays: 45 });
      expect(
        (await t.guest().post('/api/flight-bookings/hold', request(flight.id)))
          .status,
      ).toBe(401);
      expect(
        (
          await (
            await t.admin()
          ).post('/api/flight-bookings/hold', request(flight.id))
        ).status,
      ).toBe(403);
      expect(
        (
          await airline.moderator.client.post(
            '/api/flight-bookings/hold',
            request(flight.id),
          )
        ).status,
      ).toBe(403);
    });
  });

  describe('FLT-22 seat hold (Mandatory row 31), GEN-11 lifecycle', () => {
    it('reserves the seats in a Pending Payment booking held for 10 minutes', async () => {
      const flight = await bookableFlight(
        airline,
        { inDays: 46 },
        { seats: 5 },
      );
      const before = Date.now();
      const res = await hold(user, flight.id, [adult('One'), adult('Two')]);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('pending_payment');
      expect(res.body.reference).toBeNull();
      const heldFor =
        new Date(res.body.holdExpiresAt as string).getTime() - before;
      expect(heldFor).toBeGreaterThan(9.9 * 60_000);
      expect(heldFor).toBeLessThan(10.1 * 60_000);
      expect(await seatsRemaining(t, flight.id)).toBe(3);
    });

    it('rejects a request for more seats than remain and reserves nothing', async () => {
      const flight = await bookableFlight(
        airline,
        { inDays: 46 },
        { seats: 2 },
      );
      const res = await hold(user, flight.id, [
        adult('A'),
        adult('B'),
        adult('C'),
      ]);
      expect(res.status).toBe(409);
      expect(await seatsRemaining(t, flight.id)).toBe(2);
    });

    it('concurrent requests never reserve more seats than available', async () => {
      const flight = await bookableFlight(
        airline,
        { inDays: 46 },
        { seats: 4 },
      );
      const users = await Promise.all(
        Array.from({ length: 6 }, () => t.user()),
      );
      const results = await Promise.all(
        users.flatMap((u) => [hold(u, flight.id), hold(u, flight.id)]),
      );
      const statuses = results.map((r) => r.status);
      expect(statuses.filter((s) => s === 201)).toHaveLength(4);
      expect(statuses.filter((s) => s === 409)).toHaveLength(8);
      expect(await seatsRemaining(t, flight.id)).toBe(0);
      const flightDoc = await t
        .collection('flights')
        .findOne({ _id: t.oid(flight.id) });
      expect(flightDoc!.cabins[0]).toMatchObject({
        total: 4,
        held: 4,
        booked: 0,
      });
    });

    it('a round trip is one booking with two segments; both flights are reserved or none', async () => {
      const out = await bookableFlight(
        airline,
        {
          from: 'CAI',
          to: 'DXB',
          inDays: 47,
          departureTime: '08:00',
          arrivalTime: '13:00',
        },
        { seats: 5, price: 10000 },
      );
      const back = await bookableFlight(
        airline,
        {
          from: 'DXB',
          to: 'CAI',
          inDays: 50,
          departureTime: '15:00',
          arrivalTime: '17:30',
        },
        { seats: 1, price: 12000 },
      );
      const body = (count: number) => ({
        segments: [
          { flightId: out.id, cabinClass: 'economy' },
          { flightId: back.id, cabinClass: 'economy' },
        ],
        passengers: Array.from({ length: count }, (_, i) => adult(`P${i}`)),
      });
      // 2 passengers: the return flight has only 1 seat, so nothing is held on either flight.
      const tooMany = await user.client.post(
        '/api/flight-bookings/hold',
        body(2),
      );
      expect(tooMany.status).toBe(409);
      expect(await seatsRemaining(t, out.id)).toBe(5);
      expect(await seatsRemaining(t, back.id)).toBe(1);
      const one = await user.client.post('/api/flight-bookings/hold', body(1));
      expect(one.status).toBe(201);
      expect(one.body.segments).toHaveLength(2);
      expect(one.body.totalAmount).toBe(22000);
      expect(await seatsRemaining(t, out.id)).toBe(4);
      expect(await seatsRemaining(t, back.id)).toBe(0);
    });

    it('when the hold ends without payment the booking becomes Expired and the seats are released', async () => {
      const flight = await bookableFlight(
        airline,
        { inDays: 46 },
        { seats: 3 },
      );
      const booking = (await hold(user, flight.id)).body;
      expect(await seatsRemaining(t, flight.id)).toBe(2);
      // Still inside the hold: the job leaves it alone.
      await t.service(FlightBookingLifecycleService).expireHolds();
      expect(
        (await bookingDetails(user.client, 'flight', booking.id)).body.status,
      ).toBe('pending_payment');
      // The 10 minutes pass.
      await t
        .collection('flightbookings')
        .updateOne(
          { _id: t.oid(booking.id) },
          { $set: { holdExpiresAt: new Date(Date.now() - 1000) } },
        );
      await t.service(FlightBookingLifecycleService).expireHolds();
      const after = await bookingDetails(user.client, 'flight', booking.id);
      expect(after.body.status).toBe('expired');
      expect(await seatsRemaining(t, flight.id)).toBe(3);
      // GEN-11: Expired is final.
      expect(
        (await acceptPolicies(user.client, 'flight', booking.id)).status,
      ).toBe(409);
      expect(
        (await user.client.post(`/api/flight-bookings/${booking.id}/cancel`))
          .status,
      ).toBe(409);
    });

    it('ACC-11: a booking is visible to its owner only', async () => {
      const flight = await bookableFlight(airline, { inDays: 46 });
      const booking = (await hold(user, flight.id)).body;
      const stranger = await t.user();
      expect(
        (await bookingDetails(stranger.client, 'flight', booking.id)).status,
      ).toBe(404);
      expect(
        (
          await stranger.client.post(
            `/api/flight-bookings/${booking.id}/cancel`,
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await stranger.client.get(
            `/api/bookings/flight/${booking.id}/policies`,
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await stranger.client.post('/api/payments', {
            bookingType: 'flight',
            bookingId: booking.id,
            paymentMethodId: 'pm_card_visa',
          })
        ).status,
      ).toBe(404);
      expect(
        (await t.guest().get(`/api/flight-bookings/${booking.id}`)).status,
      ).toBe(401);
    });
  });

  describe('PAY-02 policies before payment (Mandatory row 57)', () => {
    it("shows the airline's cancellation and baggage policies and blocks payment until accepted", async () => {
      const flight = await bookableFlight(
        airline,
        { inDays: 48 },
        { freeBags: 1, maxBagWeightKg: 23 },
      );
      const booking = (await hold(user, flight.id)).body;
      const policies = await user.client.get(
        `/api/bookings/flight/${booking.id}/policies`,
      );
      expect(policies.status).toBe(200);
      expect(policies.body.acceptedAt).toBeNull();
      expect(policies.body.policies.cancellationTiers).toEqual([
        { daysBefore: 30, refundPercentage: 100 },
        { daysBefore: 7, refundPercentage: 50 },
        { daysBefore: 2, refundPercentage: 10 },
      ]);
      expect(policies.body.policies.baggage).toMatchObject({
        extraBagPrice: 3000,
        maxExtraBagsPerPassenger: 2,
      });
      expect(policies.body.policies.baggage.cabins[0]).toMatchObject({
        freeBags: 1,
        maxBagWeightKg: 23,
      });

      const blocked = await user.client.post('/api/payments', {
        bookingType: 'flight',
        bookingId: booking.id,
        paymentMethodId: 'pm_card_visa',
      });
      expect(blocked.status).toBe(400);
      // The checkbox must really be ticked.
      expect(
        (
          await user.client.post(
            `/api/bookings/flight/${booking.id}/accept-policies`,
            { accepted: false },
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await user.client.post(
            `/api/bookings/flight/${booking.id}/accept-policies`,
            {},
          )
        ).status,
      ).toBe(400);

      const before = Date.now();
      const accepted = await acceptPolicies(user.client, 'flight', booking.id);
      expect(accepted.status).toBe(200);
      const acceptedAt = new Date(accepted.body.acceptedAt as string).getTime();
      expect(acceptedAt).toBeGreaterThanOrEqual(before - 2000);
      expect(acceptedAt).toBeLessThanOrEqual(Date.now() + 2000);
      // Stored with its timestamp.
      expect(
        ((await stored(booking.id))!.policiesAcceptedAt as Date).getTime(),
      ).toBe(acceptedAt);
      expect(
        (await user.client.get(`/api/bookings/flight/${booking.id}/policies`))
          .body.acceptedAt,
      ).toBe(accepted.body.acceptedAt);
    });
  });

  describe('PAY-01 payment (Mandatory row 56), FLT-23 confirmation (row 32)', () => {
    it('confirms the booking only after Stripe reports the PaymentIntent as succeeded', async () => {
      const flight = await bookableFlight(
        airline,
        { inDays: 49 },
        { seats: 5, price: 25000 },
      );
      const booking = (
        await hold(user, flight.id, [adult('Pay One'), adult('Pay Two')])
      ).body;
      await acceptPolicies(user.client, 'flight', booking.id);
      const created = await user.client.post('/api/payments', {
        bookingType: 'flight',
        bookingId: booking.id,
        paymentMethodId: 'pm_card_visa',
      });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        bookingType: 'flight',
        bookingId: booking.id,
        amount: 50000,
        currency: 'USD',
      });
      expect(created.body.stripePaymentId).toMatch(/^pi_/);

      const confirmed = await t.eventually(async () => {
        const res = await bookingDetails(user.client, 'flight', booking.id);
        return res.body.status === 'confirmed' ? res.body : undefined;
      }, 'the booking to be confirmed by the webhook');

      // The PaymentIntent really succeeded at Stripe, for the booking total in the platform currency.
      const intent = await t.stripe.paymentIntents.retrieve(
        created.body.stripePaymentId as string,
      );
      expect(intent.status).toBe('succeeded');
      expect(intent.amount).toBe(50000);
      expect(intent.currency).toBe('usd');
      expect(intent.livemode).toBe(false);

      // FLT-23: unique reference, held seats become booked seats.
      expect(confirmed.reference).toMatch(/^[A-Z0-9]{6,}$/);
      expect(confirmed.payment.status).toBe('succeeded');
      const flightDoc = await t
        .collection('flights')
        .findOne({ _id: t.oid(flight.id) });
      expect(flightDoc!.cabins[0]).toMatchObject({
        total: 5,
        booked: 2,
        held: 0,
      });
      expect(await seatsRemaining(t, flight.id)).toBe(3);
      const payment = await user.client.get(`/api/payments/${created.body.id}`);
      expect(payment.body.status).toBe('succeeded');

      // FLT-23: an in-app notification with the booking details.
      const notes = await notifications(user.client);
      const note = notes.find((n) =>
        n.message.includes(confirmed.reference as string),
      );
      expect(note).toBeDefined();
      expect(note!.message).toContain(flight.flightNumber);

      // FLT-23: a downloadable e-ticket (PDF).
      const ticket = await user.client.get(
        `/api/flight-bookings/${booking.id}/e-ticket`,
      );
      expect(ticket.status).toBe(200);
      expect(ticket.headers['content-type']).toContain('application/pdf');
      expect(ticket.buffer.subarray(0, 5).toString()).toBe('%PDF-');
      expect(String(ticket.headers['content-disposition'])).toContain(
        confirmed.reference,
      );

      // PAY-01: only the Stripe payment id, amount, currency and status are stored - no card data.
      const record = await t
        .collection('payments')
        .findOne({ _id: t.oid(created.body.id as string) });
      expect(record).toMatchObject({
        stripePaymentIntentId: intent.id,
        amount: 50000,
        currency: 'USD',
        status: 'succeeded',
      });
      expect(JSON.stringify(record)).not.toMatch(
        /4242|card|cvc|exp_month|pm_card/i,
      );

      // Paying twice is refused.
      const again = await user.client.post('/api/payments', {
        bookingType: 'flight',
        bookingId: booking.id,
        paymentMethodId: 'pm_card_visa',
      });
      expect(again.status).toBe(409);
    });

    it('two confirmed bookings get different references', async () => {
      const flight = await bookableFlight(airline, { inDays: 49 });
      const first = (await hold(user, flight.id)).body;
      const second = (await hold(user, flight.id)).body;
      const [a, b] = await Promise.all([
        payAndConfirm(t, user.client, 'flight', first.id as string),
        payAndConfirm(t, user.client, 'flight', second.id as string),
      ]);
      expect(a.booking.reference).not.toBe(b.booking.reference);
    });

    it('a declined card leaves the booking unconfirmed; the user may retry until the hold expires', async () => {
      const flight = await bookableFlight(
        airline,
        { inDays: 49 },
        { seats: 2 },
      );
      const booking = (await hold(user, flight.id)).body;
      await acceptPolicies(user.client, 'flight', booking.id);
      const declined = await user.client.post('/api/payments', {
        bookingType: 'flight',
        bookingId: booking.id,
        paymentMethodId: 'pm_card_chargeDeclined',
      });
      expect(declined.status).toBe(201);
      expect(declined.body.status).toBe('failed');
      expect(declined.body.failureMessage).toMatch(/declined/i);
      const details = await bookingDetails(user.client, 'flight', booking.id);
      expect(details.body.status).toBe('pending_payment');
      expect(details.body.reference).toBeNull();
      expect(await seatsRemaining(t, flight.id)).toBe(1);

      const retry = await user.client.post(
        `/api/payments/${declined.body.id}/retry`,
        { paymentMethodId: 'pm_card_visa' },
      );
      expect(retry.status).toBe(201);
      const confirmed = await t.eventually(async () => {
        const res = await bookingDetails(user.client, 'flight', booking.id);
        return res.body.status === 'confirmed' ? res.body : undefined;
      }, 'the retried payment to confirm the booking');
      expect(confirmed.payment.status).toBe('succeeded');
    });

    it('a card that needs 3D Secure does not confirm the booking until Stripe reports success', async () => {
      const flight = await bookableFlight(airline, { inDays: 49 });
      const booking = (await hold(user, flight.id)).body;
      await acceptPolicies(user.client, 'flight', booking.id);
      const res = await user.client.post('/api/payments', {
        bookingType: 'flight',
        bookingId: booking.id,
        paymentMethodId: 'pm_card_threeDSecure2Required',
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('pending');
      // The client secret lets Stripe Elements finish the authentication in the browser.
      expect(res.body.clientSecret).toMatch(/^pi_.+_secret_/);
      const intent = await t.stripe.paymentIntents.retrieve(
        res.body.stripePaymentId as string,
      );
      expect(intent.status).toBe('requires_action');
      await new Promise((resolve) => setTimeout(resolve, 3000));
      expect(
        (await bookingDetails(user.client, 'flight', booking.id)).body.status,
      ).toBe('pending_payment');
    });

    it('when the hold expires the PaymentIntent is cancelled at Stripe and payment is refused', async () => {
      const flight = await bookableFlight(airline, { inDays: 49 });
      const booking = (await hold(user, flight.id)).body;
      await acceptPolicies(user.client, 'flight', booking.id);
      // A payment was started (no card yet), then the hold runs out.
      const started = await user.client.post('/api/payments', {
        bookingType: 'flight',
        bookingId: booking.id,
      });
      expect(started.status).toBe(201);
      await t
        .collection('flightbookings')
        .updateOne(
          { _id: t.oid(booking.id) },
          { $set: { holdExpiresAt: new Date(Date.now() - 1000) } },
        );
      const late = await user.client.post(`/api/payments`, {
        bookingType: 'flight',
        bookingId: booking.id,
        paymentMethodId: 'pm_card_visa',
      });
      expect(late.status).toBe(409);
      await t.service(FlightBookingLifecycleService).expireHolds();
      const intent = await t.stripe.paymentIntents.retrieve(
        started.body.stripePaymentId as string,
      );
      expect(intent.status).toBe('canceled');
      expect(
        (await user.client.get(`/api/payments/${started.body.id}`)).body.status,
      ).toBe('cancelled');
      expect(
        (await bookingDetails(user.client, 'flight', booking.id)).body.status,
      ).toBe('expired');
    });

    it('the webhook rejects a request without a valid Stripe signature and changes nothing', async () => {
      const flight = await bookableFlight(airline, { inDays: 49 });
      const booking = (await hold(user, flight.id)).body;
      await acceptPolicies(user.client, 'flight', booking.id);
      const started = await user.client.post('/api/payments', {
        bookingType: 'flight',
        bookingId: booking.id,
      });
      const forged = JSON.stringify({
        id: 'evt_forged',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: started.body.stripePaymentId,
            object: 'payment_intent',
            amount: started.body.amount,
            currency: 'usd',
            status: 'succeeded',
          },
        },
      });
      const unsigned = await t
        .guest()
        .post('/api/payments/webhook', undefined, { rawBody: forged });
      expect(unsigned.status).toBe(400);
      const wrongSecret = t.stripe.webhooks.generateTestHeaderString({
        payload: forged,
        secret: 'whsec_not_the_real_secret',
      });
      const badlySigned = await t
        .guest()
        .post('/api/payments/webhook', undefined, {
          rawBody: forged,
          headers: { 'stripe-signature': wrongSecret },
        });
      expect(badlySigned.status).toBe(400);
      expect(
        (await bookingDetails(user.client, 'flight', booking.id)).body.status,
      ).toBe('pending_payment');

      // A correctly signed event for an intent that is not really paid for the right amount is
      // not enough either: the amount must match the payment.
      const wrongAmount = forged.replace(
        `"amount":${started.body.amount}`,
        '"amount":1',
      );
      const signed = t.stripe.webhooks.generateTestHeaderString({
        payload: wrongAmount,
        secret: process.env.STRIPE_WEBHOOK_SECRET as string,
      });
      const accepted = await t
        .guest()
        .post('/api/payments/webhook', undefined, {
          rawBody: wrongAmount,
          headers: { 'stripe-signature': signed },
        });
      expect(accepted.status).toBe(200);
      expect(accepted.body).toEqual({ received: true });
      expect(
        (await bookingDetails(user.client, 'flight', booking.id)).body.status,
      ).toBe('pending_payment');
    });
  });

  describe('FLT-26 cancellation, PAY-03 refunds, FLT-09 tiers (Mandatory rows 34, 58, 24)', () => {
    const bookAndPay = async (inDays: number, price = 20000, seats = 5) => {
      const flight = await bookableFlight(
        airline,
        { inDays },
        { price, seats },
      );
      const booking = (await hold(user, flight.id)).body;
      const paid = await payAndConfirm(
        t,
        user.client,
        'flight',
        booking.id as string,
      );
      return { flight, bookingId: booking.id as string, payment: paid.payment };
    };

    it('shows the refund first, then cancels: 10 days before departure the 7-day tier gives 50%', async () => {
      const { flight, bookingId, payment } = await bookAndPay(10, 20001);
      expect(await seatsRemaining(t, flight.id)).toBe(4);
      const preview = (await bookingDetails(user.client, 'flight', bookingId))
        .body.cancellation;
      expect(preview).toMatchObject({
        cancellable: true,
        refundPercentage: 50,
        tierDaysBefore: 7,
        refundAmount: 10000,
        currency: 'USD',
      });

      const cancelled = await user.client.post(
        `/api/flight-bookings/${bookingId}/cancel`,
      );
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.status).toBe('cancelled');
      expect(cancelled.body.refund).toMatchObject({
        amount: 10000,
        currency: 'USD',
        refundPercentage: 50,
        reason: 'user_cancellation',
      });
      // The seats return to inventory.
      expect(await seatsRemaining(t, flight.id)).toBe(5);

      // The refund really exists at Stripe, for exactly that amount, on that payment.
      const refundId = cancelled.body.refund.id as string;
      const refund = await t.eventually(async () => {
        const res = await user.client.get(`/api/refunds/${refundId}`);
        return res.body.status === 'refunded' ? res.body : undefined;
      }, 'the refund to be Refunded');
      const stripeRefund = await t.stripe.refunds.retrieve(
        refund.stripeRefundId as string,
      );
      expect(stripeRefund).toMatchObject({
        amount: 10000,
        currency: 'usd',
        status: 'succeeded',
        payment_intent: payment.stripePaymentId,
      });
      // PAY-03: the status is shown on the booking details and the user is notified.
      const details = await bookingDetails(user.client, 'flight', bookingId);
      expect(details.body.refund).toMatchObject({
        id: refundId,
        status: 'refunded',
        amount: 10000,
      });
      const notes = await notifications(user.client);
      expect(
        notes.some(
          (n) =>
            /cancel/i.test(n.title) &&
            n.message.includes(details.body.reference as string),
        ),
      ).toBe(true);
      expect(
        notes.some(
          (n) => /refund/i.test(n.title) && n.message.includes('100.00'),
        ),
      ).toBe(true);
      // GEN-11: Cancelled is final.
      expect(
        (await user.client.post(`/api/flight-bookings/${bookingId}/cancel`))
          .status,
      ).toBe(409);
    });

    it('uses the tier with the highest threshold not exceeding the days remaining', async () => {
      // 40 days: tier 30 -> 100%. 5 days: tier 2 -> 10%. 1 day: no tier -> 0%.
      const cases: [number, number, number | null][] = [
        [40, 100, 30],
        [5, 10, 2],
        [1, 0, null],
      ];
      for (const [inDays, percentage, tier] of cases) {
        const { bookingId } = await bookAndPay(inDays, 30000);
        const preview = (await bookingDetails(user.client, 'flight', bookingId))
          .body.cancellation;
        expect(preview).toMatchObject({
          refundPercentage: percentage,
          tierDaysBefore: tier,
          refundAmount: (30000 * percentage) / 100,
        });
      }
    });

    it('PDF 6.4: the refund follows the tiers accepted with the booking, even after the airline changes them', async () => {
      const { bookingId } = await bookAndPay(10, 20000);
      const policy = `/api/airlines/${airline.airlineId}/cancellation-policy`;
      // After the user paid, the airline drops its 7-day and 2-day tiers (10 days left -> 0%).
      const changed = await airline.moderator.client.put(policy, {
        tiers: [{ daysBefore: 30, refundPercentage: 100 }],
      });
      expect(changed.status).toBe(200);
      try {
        const preview = (await bookingDetails(user.client, 'flight', bookingId))
          .body.cancellation;
        expect(preview).toMatchObject({
          refundPercentage: 50,
          tierDaysBefore: 7,
          refundAmount: 10000,
        });
        const cancelled = await user.client.post(
          `/api/flight-bookings/${bookingId}/cancel`,
        );
        expect(cancelled.status).toBe(200);
        expect(cancelled.body.refund).toMatchObject({
          amount: 10000,
          refundPercentage: 50,
        });
        const refund = await t
          .collection('refunds')
          .findOne({ bookingId: t.oid(bookingId) });
        expect(refund).toMatchObject({
          refundPercentage: 50,
          tierDaysBefore: 7,
        });
      } finally {
        await airline.moderator.client.put(policy, {
          tiers: [
            { daysBefore: 30, refundPercentage: 100 },
            { daysBefore: 7, refundPercentage: 50 },
            { daysBefore: 2, refundPercentage: 10 },
          ],
        });
      }
    });

    it('with no applicable tier the refund is 0%: the booking is cancelled and no refund is created', async () => {
      const { bookingId } = await bookAndPay(1);
      const cancelled = await user.client.post(
        `/api/flight-bookings/${bookingId}/cancel`,
      );
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.status).toBe('cancelled');
      expect(cancelled.body.refund).toBeNull();
      expect(
        await t
          .collection('refunds')
          .countDocuments({ bookingId: t.oid(bookingId) }),
      ).toBe(0);
    });

    it('cancellation after departure is blocked', async () => {
      const { bookingId, flight } = await bookAndPay(3);
      const past = new Date(Date.now() - 60_000);
      await t
        .collection('flights')
        .updateOne({ _id: t.oid(flight.id) }, { $set: { departureAt: past } });
      await t
        .collection('flightbookings')
        .updateOne(
          { _id: t.oid(bookingId) },
          { $set: { 'segments.0.departureAt': past } },
        );
      const preview = (await bookingDetails(user.client, 'flight', bookingId))
        .body.cancellation;
      expect(preview.cancellable).toBe(false);
      expect(
        (await user.client.post(`/api/flight-bookings/${bookingId}/cancel`))
          .status,
      ).toBe(409);
      // Not cancelled. (The app's own every-minute job may already have marked it Completed.)
      expect(['confirmed', 'completed']).toContain(
        (await bookingDetails(user.client, 'flight', bookingId)).body.status,
      );
      // GEN-11: Confirmed -> Completed once the flight has departed.
      await t.service(FlightBookingLifecycleService).completeDeparted();
      expect(
        (await bookingDetails(user.client, 'flight', bookingId)).body.status,
      ).toBe('completed');
      expect(
        (await user.client.post(`/api/flight-bookings/${bookingId}/cancel`))
          .status,
      ).toBe(409);
    });

    it('a Pending Payment booking cannot be cancelled (GEN-11: only Confirmed -> Cancelled)', async () => {
      const flight = await bookableFlight(airline, { inDays: 20 });
      const booking = (await hold(user, flight.id)).body;
      expect(
        (await user.client.post(`/api/flight-bookings/${booking.id}/cancel`))
          .status,
      ).toBe(409);
      expect(
        (await bookingDetails(user.client, 'flight', booking.id)).body.status,
      ).toBe('pending_payment');
    });
  });

  describe('FLT-06 airline cancels a flight (Mandatory row 22), FLT-05 time change (row 21)', () => {
    it('Confirmed bookings are cancelled with a 100% refund, holds are released, passengers are notified', async () => {
      const mine = await airlineWithModerator(t);
      const flight = await bookableFlight(
        mine,
        { inDays: 3 },
        { seats: 5, price: 15000 },
      );
      const payer = await t.user('Paid Passenger');
      const holder = await t.user('Holding Passenger');
      const paidBooking = (await hold(payer, flight.id)).body;
      const { payment } = await payAndConfirm(
        t,
        payer.client,
        'flight',
        paidBooking.id as string,
      );
      const heldBooking = (await hold(holder, flight.id)).body;

      const other = await airlineWithModerator(t);
      expect(
        (await other.moderator.client.post(`/api/flights/${flight.id}/cancel`))
          .status,
      ).toBe(403);

      const cancelled = await mine.moderator.client.post(
        `/api/flights/${flight.id}/cancel`,
      );
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.flight.status).toBe('cancelled');
      expect(cancelled.body.cancelledBookings).toBe(1);

      // Hidden from search.
      const found = await t.guest().get('/api/flights/search', {
        query: { origin: 'DXB', destination: 'RUH', departureDate: day(3) },
      });
      expect((found.body.items as any[]).map((f) => f.id)).not.toContain(
        flight.id,
      );

      // 3 days before departure the tiers would give 10%, but a provider cancellation refunds 100%.
      const paidAfter = await bookingDetails(
        payer.client,
        'flight',
        paidBooking.id as string,
      );
      expect(paidAfter.body.status).toBe('cancelled');
      const refund = await t.eventually(async () => {
        const res = await bookingDetails(
          payer.client,
          'flight',
          paidBooking.id as string,
        );
        return res.body.refund?.status === 'refunded'
          ? res.body.refund
          : undefined;
      }, 'the 100% refund');
      expect(refund).toMatchObject({
        amount: 15000,
        refundPercentage: 100,
        reason: 'provider_cancellation',
      });
      const stripeRefund = await t.stripe.refunds.retrieve(
        refund.stripeRefundId as string,
      );
      expect(stripeRefund).toMatchObject({
        amount: 15000,
        status: 'succeeded',
        payment_intent: payment.stripePaymentId,
      });

      // The pending hold is released: not Confirmed, never charged.
      const heldAfter = await bookingDetails(
        holder.client,
        'flight',
        heldBooking.id as string,
      );
      expect(heldAfter.body.status).toBe('expired');
      const flightDoc = await t
        .collection('flights')
        .findOne({ _id: t.oid(flight.id) });
      expect(flightDoc!.cabins[0]).toMatchObject({ booked: 0, held: 0 });

      // Passengers receive an in-app notification.
      expect(
        (await notifications(payer.client)).some(
          (n) =>
            /cancel/i.test(n.title) && /airline/i.test(n.title + n.message),
        ),
      ).toBe(true);
      // A cancelled flight cannot be booked or cancelled again.
      expect((await hold(payer, flight.id)).status).toBe(409);
      expect(
        (await mine.moderator.client.post(`/api/flights/${flight.id}/cancel`))
          .status,
      ).toBe(409);
    });

    it('FLT-05: a time change notifies passengers with Confirmed bookings; price changes do not touch bookings; seats cannot go below booked + held; airports are fixed once booked', async () => {
      const mine = await airlineWithModerator(t);
      const flight = await bookableFlight(
        mine,
        { inDays: 55 },
        { seats: 5, price: 15000 },
      );
      const payer = await t.user('Confirmed Passenger');
      const holder = await t.user('Pending Passenger');
      const paidBooking = (
        await hold(payer, flight.id, [adult('A'), adult('B')])
      ).body;
      await payAndConfirm(t, payer.client, 'flight', paidBooking.id as string);
      await hold(holder, flight.id);
      const cabinId = (await t.collection('flights').findOne({
        _id: t.oid(flight.id),
      }))!.cabins[0]._id.toString() as string;
      const patchCabin = (body: unknown) =>
        mine.moderator.client.patch(
          `/api/flights/${flight.id}/cabins/${cabinId}`,
          body,
        );

      // 2 booked + 1 held = 3.
      expect((await patchCabin({ seats: 2 })).status).toBe(400);
      expect((await patchCabin({ seats: 3 })).status).toBe(200);
      expect(await seatsRemaining(t, flight.id)).toBe(0);

      expect((await patchCabin({ price: 99000 })).status).toBe(200);
      const afterPrice = await bookingDetails(
        payer.client,
        'flight',
        paidBooking.id as string,
      );
      expect(afterPrice.body.totalAmount).toBe(30000);
      expect(afterPrice.body.segments[0].fare).toBe(15000);

      const airports = await mine.moderator.client.patch(
        `/api/flights/${flight.id}`,
        { arrivalAirport: 'CAI' },
      );
      expect(airports.status).toBe(409);

      const before = (await notifications(holder.client)).length;
      const moved = await mine.moderator.client.patch(
        `/api/flights/${flight.id}`,
        {
          departureLocal: `${day(55)}T14:00`,
          arrivalLocal: `${day(55)}T15:00`,
        },
      );
      expect(moved.status).toBe(200);
      const note = (await notifications(payer.client)).find((n) =>
        /time/i.test(n.title),
      );
      expect(note).toBeDefined();
      expect(note!.message).toContain(flight.flightNumber);
      expect(note!.message).toContain('14:00');
      // Only passengers with Confirmed bookings are notified.
      expect((await notifications(holder.client)).length).toBe(before);
      // The booking shows the new time.
      expect(
        (await bookingDetails(payer.client, 'flight', paidBooking.id as string))
          .body.segments[0].departureAt,
      ).toBe(`${day(55)}T10:00:00.000Z`);
    });
  });

  describe('FLT-25 my bookings (Mandatory row 33), FLT-29 moderator view (row 35), ACC-17 admin view (row 16)', () => {
    let mine: AirlineSetup;
    let owner: Account;
    let flightId: string;
    let flightNumber: string;
    let upcoming: any;
    let cancelledId: string;
    let pastId: string;

    beforeAll(async () => {
      mine = await airlineWithModerator(t);
      owner = await t.user('List Owner');
      const flight = await bookableFlight(
        mine,
        { inDays: 35 },
        { seats: 9, price: 11000 },
      );
      flightId = flight.id;
      flightNumber = flight.flightNumber;
      const a = (
        await hold(owner, flightId, [adult('Up One'), adult('Up Two')])
      ).body;
      upcoming = (
        await payAndConfirm(t, owner.client, 'flight', a.id as string)
      ).booking;
      const b = (await hold(owner, flightId, [adult('Gone One')])).body;
      await payAndConfirm(t, owner.client, 'flight', b.id as string);
      await owner.client.post(`/api/flight-bookings/${b.id}/cancel`);
      cancelledId = b.id as string;
      // A booking on a flight that has departed since.
      const old = await bookableFlight(mine, { inDays: 2 }, { price: 9000 });
      const c = (await hold(owner, old.id, [adult('Past One')])).body;
      await payAndConfirm(t, owner.client, 'flight', c.id as string);
      const past = new Date(Date.now() - 3600_000);
      await t
        .collection('flightbookings')
        .updateOne(
          { _id: t.oid(c.id as string) },
          { $set: { 'segments.0.departureAt': past } },
        );
      await t.service(FlightBookingLifecycleService).completeDeparted();
      pastId = c.id as string;
    });

    const list = async (group: string) =>
      (await owner.client.get('/api/flight-bookings', { query: { group } }))
        .body.items as any[];

    it('groups own bookings as Upcoming, Past and Cancelled with reference, flight, date, passengers, cabin, status', async () => {
      const up = await list('upcoming');
      expect(up.map((b) => b.id)).toEqual([upcoming.id]);
      expect(up[0]).toMatchObject({
        reference: upcoming.reference,
        flightNumber,
        passengers: 2,
        cabinClass: 'economy',
        status: 'confirmed',
      });
      expect(up[0].departureAt).toBe(`${day(35)}T06:00:00.000Z`);
      expect((await list('cancelled')).map((b) => [b.id, b.status])).toEqual([
        [cancelledId, 'cancelled'],
      ]);
      expect((await list('past')).map((b) => [b.id, b.status])).toEqual([
        [pastId, 'completed'],
      ]);
      expect(
        (
          await owner.client.get('/api/flight-bookings', {
            query: { group: 'someday' },
          })
        ).status,
      ).toBe(400);
      // Another user sees none of them.
      const stranger = await t.user();
      for (const group of ['upcoming', 'past', 'cancelled']) {
        expect(
          (
            await stranger.client.get('/api/flight-bookings', {
              query: { group },
            })
          ).body.total,
        ).toBe(0);
      }
    });

    // Team leader decision 24 Nov: Upcoming also lists held (Pending Payment) bookings until the hold
    // ends, with holdExpiresAt; ACC-12 still counts Confirmed bookings only.
    it('Upcoming also lists a held booking with its hold time until the hold ends; a hold alone does not block deactivation', async () => {
      const holder = await t.user('Hold Holder');
      const held = (await hold(holder, flightId, [adult('Held One')])).body;
      const items = (
        await holder.client.get('/api/flight-bookings', {
          query: { group: 'upcoming' },
        })
      ).body.items as any[];
      expect(items.map((b) => [b.id, b.status, b.holdExpiresAt])).toEqual([
        [held.id, 'pending_payment', held.holdExpiresAt],
      ]);

      await t
        .collection('flightbookings')
        .updateOne(
          { _id: t.oid(held.id as string) },
          { $set: { holdExpiresAt: new Date(Date.now() - 1000) } },
        );
      expect(
        (
          await holder.client.get('/api/flight-bookings', {
            query: { group: 'upcoming' },
          })
        ).body.total,
      ).toBe(0);

      const other = await t.user('Hold Only');
      await hold(other, flightId, [adult('Held Two')]);
      expect((await other.client.delete('/api/users/me')).status).toBe(204);
    });

    it('full details show flight, passengers, total and payment status', async () => {
      const res = await bookingDetails(
        owner.client,
        'flight',
        upcoming.id as string,
      );
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: upcoming.id,
        reference: upcoming.reference,
        status: 'confirmed',
        totalAmount: 22000,
        currency: 'USD',
        seats: 2,
      });
      expect((res.body.passengers as any[]).map((p) => p.fullName)).toEqual([
        'Up One',
        'Up Two',
      ]);
      expect(res.body.payment.status).toBe('succeeded');
      expect(res.body.payment.clientSecret).toBeUndefined();
    });

    it('FLT-29: the airline moderator sees the bookings of the flight and the seats remaining', async () => {
      const res = await mine.moderator.client.get(
        `/api/flights/${flightId}/bookings`,
      );
      expect(res.status).toBe(200);
      const rows = (res.body.items as any[]).map((b) => [
        b.reference,
        b.passengerNames,
        b.cabinClass,
        b.seats,
        b.status,
      ]);
      expect(rows).toEqual(
        expect.arrayContaining([
          [upcoming.reference, ['Up One', 'Up Two'], 'economy', 2, 'confirmed'],
        ]),
      );
      expect(
        (res.body.items as any[]).find((b) => b.id === cancelledId),
      ).toMatchObject({ passengerNames: ['Gone One'], status: 'cancelled' });
      expect(res.body.seatsRemaining).toEqual([
        { cabinClass: 'economy', seatsRemaining: 7 },
      ]);
      const other = await airlineWithModerator(t);
      expect(
        (await other.moderator.client.get(`/api/flights/${flightId}/bookings`))
          .status,
      ).toBe(403);
      expect(
        (await owner.client.get(`/api/flights/${flightId}/bookings`)).status,
      ).toBe(403);
      expect(
        (await t.guest().get(`/api/flights/${flightId}/bookings`)).status,
      ).toBe(401);
    });

    it('FLT-29: exports the passenger list as CSV', async () => {
      const res = await mine.moderator.client.get(
        `/api/flights/${flightId}/passengers/export`,
      );
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      const lines = res.text.trim().split('\n');
      expect(lines[0].split(',')).toEqual(
        expect.arrayContaining([
          'reference',
          'passengerName',
          'cabin',
          'status',
        ]),
      );
      expect(lines).toContain(
        `${upcoming.reference},Up One,adult,economy,confirmed`,
      );
      expect(lines).toContain(
        `${upcoming.reference},Up Two,adult,economy,confirmed`,
      );
      const other = await airlineWithModerator(t);
      expect(
        (
          await other.moderator.client.get(
            `/api/flights/${flightId}/passengers/export`,
          )
        ).status,
      ).toBe(403);
    });

    it('ACC-17: the admin sees a read-only list of all bookings, filterable by type, status and date range', async () => {
      const admin = await t.admin();
      const res = await admin.get('/api/admin/bookings', {
        query: {
          type: 'flight',
          status: 'confirmed',
          from: day(35),
          to: day(35),
        },
      });
      expect(res.status).toBe(200);
      const row = (res.body.items as any[]).find((b) => b.id === upcoming.id);
      expect(row).toMatchObject({
        type: 'flight',
        reference: upcoming.reference,
        amount: 22000,
        status: 'confirmed',
        user: { id: owner.id, email: owner.email },
        provider: { id: mine.airlineId, type: 'airline' },
      });
      expect(row.dates.from).toBe(`${day(35)}T06:00:00.000Z`);
      const none = await admin.get('/api/admin/bookings', {
        query: {
          type: 'hotel',
          from: day(35),
          to: day(35),
          status: 'confirmed',
        },
      });
      expect((none.body.items as any[]).map((b) => b.id)).not.toContain(
        upcoming.id,
      );
      const cancelledOnly = await admin.get('/api/admin/bookings', {
        query: { type: 'flight', status: 'cancelled' },
      });
      expect(
        (cancelledOnly.body.items as any[]).every(
          (b) => b.status === 'cancelled',
        ),
      ).toBe(true);
      expect(
        (
          await admin.get('/api/admin/bookings', {
            query: { from: day(36), to: day(35) },
          })
        ).status,
      ).toBe(400);
      expect((await owner.client.get('/api/admin/bookings')).status).toBe(403);
      expect(
        (await mine.moderator.client.get('/api/admin/bookings')).status,
      ).toBe(403);
      // Read-only: there is no way to change a booking through the admin list.
      expect(
        (
          await admin.patch(`/api/admin/bookings/${upcoming.id}`, {
            status: 'cancelled',
          })
        ).status,
      ).toBe(404);
      expect(
        (await admin.delete(`/api/admin/bookings/${upcoming.id}`)).status,
      ).toBe(404);
    });

    it('ACC-12: deactivation is blocked while the user has upcoming Confirmed bookings', async () => {
      const res = await owner.client.delete('/api/users/me');
      expect(res.status).toBe(409);
      expect((await owner.client.get('/api/auth/me')).status).toBe(200);
    });
  });

  describe('ACC-15 deactivating an airline (Mandatory row 14, PDF 8.2 "affected parties")', () => {
    it('notifies each user with a Confirmed booking once; the booking stays valid; a pending hold gets no message', async () => {
      const admin = await t.admin();
      const own = await airlineWithModerator(t);
      const flight = await bookableFlight(own, { inDays: 20 });
      const booked = await t.user('Booked Traveller');
      const holding = await t.user('Holding Traveller');
      const first = (await hold(booked, flight.id)).body.id as string;
      const second = (await hold(booked, flight.id)).body.id as string;
      await payAndConfirm(t, booked.client, 'flight', first);
      await payAndConfirm(t, booked.client, 'flight', second);
      expect((await hold(holding, flight.id)).status).toBe(201);

      const off = await admin.patch(
        `/api/admin/providers/airline/${own.airlineId}/deactivate`,
        { reason: 'Operating licence suspended' },
      );
      expect(off.status).toBe(200);

      const messages = (await notifications(booked.client)).filter((n) =>
        /deactivated/i.test(n.title),
      );
      expect(messages).toHaveLength(1);
      expect(messages[0].message).toContain('Operating licence suspended');
      expect(messages[0].message).toContain('2 Confirmed flight bookings');
      expect(
        (await notifications(holding.client)).some((n) =>
          /deactivated/i.test(n.title),
        ),
      ).toBe(false);
      expect(
        (await bookingDetails(booked.client, 'flight', first)).body.status,
      ).toBe('confirmed');
    });
  });
});
