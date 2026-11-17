import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { BookingStatus, BookingType } from '../common/enums';
import { FlightBookingsService } from '../flight-bookings/flight-bookings.service';
import { HotelBookingsService } from '../hotel-bookings/hotel-bookings.service';
import { BookingGateway } from './booking-gateway.service';
import { PayableBooking } from './interfaces/payable-booking.interface';
import { PaymentsService } from './payments.service';
import { RefundsService } from './refunds.service';
import { Payment, PaymentStatus } from './schemas/payment.schema';
import { RefundReason } from './schemas/refund.schema';

// PAY-01 unit tests (PaymentsService). Stripe and MongoDB are faked; webhook signatures are real (signed locally
// with a test secret), so no network or database is used.

const WEBHOOK_SECRET = 'whsec_test_secret';
const USER_ID = '665f1c2a9b1e8a0012345601';
const BOOKING_ID = '665f1c2a9b1e8a0012345602';

const realStripe = new Stripe('sk_test_dummy');

function signedEvent(type: string, object: Record<string, unknown>) {
  const payload = JSON.stringify({
    id: 'evt_test',
    object: 'event',
    type,
    data: { object },
  });
  const signature = realStripe.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
  });
  return { rawBody: Buffer.from(payload), signature };
}

function pendingBooking(
  overrides: Partial<PayableBooking> = {},
): PayableBooking {
  return {
    id: BOOKING_ID,
    userId: USER_ID,
    status: BookingStatus.PendingPayment,
    totalAmount: 25000,
    currency: 'USD',
    holdExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    policiesAcceptedAt: new Date(),
    ...overrides,
  };
}

describe('PaymentsService (PAY-01)', () => {
  let service: PaymentsService;
  let paymentModel: { findOne: jest.Mock; create: jest.Mock };
  let stripe: {
    webhooks: Stripe['webhooks'];
    paymentIntents: Record<string, jest.Mock>;
    refunds: { create: jest.Mock };
  };
  let flightBookings: {
    findPayableBooking: jest.Mock;
    confirmPaidBooking: jest.Mock;
  };
  let refunds: { refundBooking: jest.Mock; onStripeRefundEvent: jest.Mock };

  beforeEach(() => {
    paymentModel = { findOne: jest.fn(), create: jest.fn() };
    stripe = {
      webhooks: realStripe.webhooks,
      paymentIntents: {
        create: jest.fn(),
        retrieve: jest.fn(),
        confirm: jest.fn(),
        cancel: jest.fn(),
      },
      refunds: { create: jest.fn() },
    };
    flightBookings = {
      findPayableBooking: jest.fn(),
      confirmPaidBooking: jest.fn(),
    };
    refunds = { refundBooking: jest.fn(), onStripeRefundEvent: jest.fn() };
    const config = {
      getOrThrow: (key: string) =>
        key === 'PLATFORM_CURRENCY' ? 'USD' : WEBHOOK_SECRET,
    };

    service = new PaymentsService(
      paymentModel as unknown as Model<Payment>,
      stripe as unknown as Stripe,
      config as unknown as ConfigService,
      new BookingGateway(
        flightBookings as unknown as FlightBookingsService,
        {} as HotelBookingsService,
      ),
      refunds as unknown as RefundsService,
    );
  });

  describe('createPayment', () => {
    const dto = { bookingType: BookingType.Flight, bookingId: BOOKING_ID };

    it("returns 404 for another user's booking", async () => {
      flightBookings.findPayableBooking.mockResolvedValue(
        pendingBooking({ userId: '665f1c2a9b1e8a0012345699' }),
      );
      await expect(service.createPayment(USER_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns 409 when the hold has expired', async () => {
      flightBookings.findPayableBooking.mockResolvedValue(
        pendingBooking({ holdExpiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(service.createPayment(USER_ID, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('returns 400 when the policies were not accepted (PAY-02)', async () => {
      flightBookings.findPayableBooking.mockResolvedValue(
        pendingBooking({ policiesAcceptedAt: null }),
      );
      await expect(service.createPayment(USER_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns 409 when the booking is already paid', async () => {
      flightBookings.findPayableBooking.mockResolvedValue(pendingBooking());
      paymentModel.findOne.mockResolvedValue({
        status: PaymentStatus.Succeeded,
      });
      await expect(service.createPayment(USER_ID, dto)).rejects.toThrow(
        ConflictException,
      );
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('creates a PaymentIntent for the booking total in the platform currency', async () => {
      flightBookings.findPayableBooking.mockResolvedValue(pendingBooking());
      paymentModel.findOne.mockResolvedValue(null);
      stripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_1',
        amount: 25000,
        client_secret: 'pi_1_secret',
      });
      paymentModel.create.mockImplementation((doc: Record<string, unknown>) =>
        Promise.resolve({
          ...doc,
          _id: { toString: () => 'payment-1' },
          bookingId: { toString: () => BOOKING_ID },
        }),
      );

      const result = await service.createPayment(USER_ID, dto);

      const [params] = stripe.paymentIntents.create.mock.calls[0] as [
        Stripe.PaymentIntentCreateParams,
      ];
      expect(params.amount).toBe(25000);
      expect(params.currency).toBe('usd');
      expect(result).toMatchObject({
        id: 'payment-1',
        status: PaymentStatus.Pending,
        clientSecret: 'pi_1_secret',
      });
    });
  });

  describe('handleWebhook', () => {
    function storedPayment(status = PaymentStatus.Pending) {
      return {
        _id: { toString: () => 'payment-1' },
        bookingType: BookingType.Flight,
        bookingId: { toString: () => BOOKING_ID },
        stripePaymentIntentId: 'pi_1',
        amount: 25000,
        currency: 'USD',
        status,
        failureMessage: undefined as string | undefined,
        save: jest.fn().mockResolvedValue(undefined),
      };
    }

    it('rejects a request without a signature', async () => {
      await expect(
        service.handleWebhook(Buffer.from('{}'), undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an invalid signature', async () => {
      const { rawBody } = signedEvent('payment_intent.succeeded', {});
      await expect(
        service.handleWebhook(rawBody, 't=1,v1=bad'),
      ).rejects.toThrow(BadRequestException);
    });

    it('confirms the booking only after a verified successful payment', async () => {
      const payment = storedPayment();
      paymentModel.findOne.mockResolvedValue(payment);
      flightBookings.confirmPaidBooking.mockResolvedValue('confirmed');

      const { rawBody, signature } = signedEvent('payment_intent.succeeded', {
        id: 'pi_1',
        object: 'payment_intent',
        amount: 25000,
        currency: 'usd',
      });
      await service.handleWebhook(rawBody, signature);

      expect(payment.status).toBe(PaymentStatus.Succeeded);
      expect(flightBookings.confirmPaidBooking).toHaveBeenCalledWith(
        BOOKING_ID,
        'payment-1',
      );
      expect(refunds.refundBooking).not.toHaveBeenCalled();
    });

    it('refunds a payment that succeeded after the hold expired', async () => {
      paymentModel.findOne.mockResolvedValue(storedPayment());
      flightBookings.confirmPaidBooking.mockResolvedValue('not_confirmable');

      const { rawBody, signature } = signedEvent('payment_intent.succeeded', {
        id: 'pi_1',
        object: 'payment_intent',
        amount: 25000,
        currency: 'usd',
      });
      await service.handleWebhook(rawBody, signature);

      expect(refunds.refundBooking).toHaveBeenCalledWith({
        bookingType: BookingType.Flight,
        bookingId: BOOKING_ID,
        refundPercentage: 100,
        reason: RefundReason.HoldExpired,
      });
    });

    it('passes refund events to RefundsService (PAY-03)', async () => {
      const { rawBody, signature } = signedEvent('refund.updated', {
        id: 're_1',
        object: 'refund',
        status: 'succeeded',
      });
      await service.handleWebhook(rawBody, signature);

      expect(refunds.onStripeRefundEvent).toHaveBeenCalledWith(
        expect.objectContaining({ id: 're_1' }),
      );
    });

    it('does not confirm when the amount does not match', async () => {
      paymentModel.findOne.mockResolvedValue(storedPayment());

      const { rawBody, signature } = signedEvent('payment_intent.succeeded', {
        id: 'pi_1',
        object: 'payment_intent',
        amount: 1,
        currency: 'usd',
      });
      await service.handleWebhook(rawBody, signature);

      expect(flightBookings.confirmPaidBooking).not.toHaveBeenCalled();
    });

    it('marks the payment failed and leaves the booking unconfirmed', async () => {
      const payment = storedPayment();
      paymentModel.findOne.mockResolvedValue(payment);

      const { rawBody, signature } = signedEvent(
        'payment_intent.payment_failed',
        {
          id: 'pi_1',
          object: 'payment_intent',
          last_payment_error: { message: 'Your card was declined.' },
        },
      );
      await service.handleWebhook(rawBody, signature);

      expect(payment.status).toBe(PaymentStatus.Failed);
      expect(payment.failureMessage).toBe('Your card was declined.');
      expect(flightBookings.confirmPaidBooking).not.toHaveBeenCalled();
    });
  });
});
