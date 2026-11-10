import { ConflictException, NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { BookingType } from '../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { RefundsService } from './refunds.service';
import { Payment, PaymentStatus } from './schemas/payment.schema';
import { Refund, RefundReason, RefundStatus } from './schemas/refund.schema';

// PAY-03 unit tests (RefundsService). Stripe and MongoDB are faked.

const BOOKING_ID = '665f1c2a9b1e8a0012345602';
const USER_ID = '665f1c2a9b1e8a0012345601';

function fakePayment() {
  return {
    _id: { toString: () => 'payment-1' },
    userId: { toString: () => USER_ID },
    stripePaymentIntentId: 'pi_1',
    amount: 25000,
    currency: 'USD',
    status: PaymentStatus.Succeeded,
  };
}

function fakeRefundDoc(fields: Record<string, unknown>) {
  return {
    _id: { toString: () => 'refund-1' },
    bookingId: { toString: () => BOOKING_ID },
    paymentId: { toString: () => 'payment-1' },
    tierDaysBefore: null,
    ...fields,
    save: jest.fn().mockResolvedValue(undefined),
  } as Record<string, any>;
}

describe('RefundsService (PAY-03)', () => {
  let service: RefundsService;
  let refundModel: Record<string, jest.Mock>;
  let paymentModel: Record<string, jest.Mock>;
  let stripe: { refunds: { create: jest.Mock; retrieve: jest.Mock } };
  let notifications: { notify: jest.Mock };

  const userCancellation = {
    bookingType: BookingType.Flight,
    bookingId: BOOKING_ID,
    refundPercentage: 50,
    reason: RefundReason.UserCancellation,
    tierDaysBefore: 7,
  };

  beforeEach(() => {
    refundModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    notifications = { notify: jest.fn().mockResolvedValue(undefined) };
    paymentModel = { findOne: jest.fn(), findById: jest.fn() };
    stripe = { refunds: { create: jest.fn(), retrieve: jest.fn() } };
    paymentModel.findOne.mockResolvedValue(fakePayment());
    paymentModel.findById.mockResolvedValue(fakePayment());
    refundModel.findOne.mockResolvedValue(null);
    refundModel.create.mockImplementation((doc: Record<string, unknown>) =>
      Promise.resolve(fakeRefundDoc(doc)),
    );
    service = new RefundsService(
      refundModel as unknown as Model<Refund>,
      paymentModel as unknown as Model<Payment>,
      stripe as unknown as Stripe,
      notifications as unknown as NotificationsService,
    );
  });

  // GEN-01
  it('notifies the user once when the refund is refunded', async () => {
    stripe.refunds.create.mockResolvedValue({
      id: 're_1',
      status: 'succeeded',
    });

    await service.refundBooking(userCancellation);

    expect(refundModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ notified: { $ne: RefundStatus.Refunded } }),
      { $addToSet: { notified: RefundStatus.Refunded } },
    );
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.anything(),
      'Refund completed',
      expect.stringContaining('125.00 USD'),
    );
  });

  it('sends nothing when the status was already notified (Stripe reply and webhook at once)', async () => {
    stripe.refunds.create.mockResolvedValue({
      id: 're_1',
      status: 'succeeded',
    });
    refundModel.updateOne.mockResolvedValue({ modifiedCount: 0 });

    await service.refundBooking(userCancellation);

    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('explains a late payment refund, and does not notify a pending refund', async () => {
    stripe.refunds.create.mockResolvedValue({ id: 're_1', status: 'pending' });

    await service.refundBooking({
      bookingType: BookingType.Hotel,
      bookingId: BOOKING_ID,
      refundPercentage: 100,
      reason: RefundReason.HoldExpired,
    });

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.anything(),
      'Late payment refunded',
      expect.stringContaining('250.00 USD'),
    );
    expect(refundModel.updateOne).not.toHaveBeenCalled();
  });

  it('refunds the tier percentage of the amount paid through Stripe', async () => {
    stripe.refunds.create.mockResolvedValue({
      id: 're_1',
      status: 'succeeded',
    });

    const result = await service.refundBooking(userCancellation);

    expect(stripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_1', amount: 12500 }),
      { idempotencyKey: 'refund-refund-1' },
    );
    expect(result).toMatchObject({
      amount: 12500,
      currency: 'USD',
      refundPercentage: 50,
      tierDaysBefore: 7,
      reason: RefundReason.UserCancellation,
      status: RefundStatus.Refunded,
      stripeRefundId: 're_1',
    });
  });

  it('rounds down to whole cents', async () => {
    stripe.refunds.create.mockResolvedValue({ id: 're_1', status: 'pending' });
    const result = await service.refundBooking({
      ...userCancellation,
      refundPercentage: 33.3,
    });
    expect(result?.amount).toBe(8325); // 25000 * 33.3% = 8325
    expect(result?.status).toBe(RefundStatus.Pending);
  });

  it('creates no refund for 0%', async () => {
    const result = await service.refundBooking({
      ...userCancellation,
      refundPercentage: 0,
    });
    expect(result).toBeNull();
    expect(refundModel.create).not.toHaveBeenCalled();
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it('refuses a percentage outside 0-100', async () => {
    await expect(
      service.refundBooking({ ...userCancellation, refundPercentage: 150 }),
    ).rejects.toThrow(RangeError);
  });

  it('refuses a booking without a successful payment', async () => {
    paymentModel.findOne.mockResolvedValue(null);
    await expect(service.refundBooking(userCancellation)).rejects.toThrow(
      ConflictException,
    );
  });

  it('returns the existing refund instead of refunding twice', async () => {
    refundModel.findOne.mockResolvedValue(
      fakeRefundDoc({
        bookingType: BookingType.Flight,
        amount: 12500,
        status: RefundStatus.Refunded,
        stripeRefundId: 're_1',
      }),
    );
    const result = await service.refundBooking(userCancellation);
    expect(result?.stripeRefundId).toBe('re_1');
    expect(refundModel.create).not.toHaveBeenCalled();
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it('records the refund as failed when Stripe is unavailable', async () => {
    stripe.refunds.create.mockRejectedValue(
      new Stripe.errors.StripeConnectionError({
        message: 'Stripe is down',
        type: 'StripeConnectionError',
      } as never),
    );
    const result = await service.refundBooking(userCancellation);
    expect(result).toMatchObject({
      status: RefundStatus.Failed,
      failureReason: 'Stripe is down',
      stripeRefundId: null,
    });
  });

  it('retries a refund that never reached Stripe', async () => {
    refundModel.findOne.mockResolvedValue(
      fakeRefundDoc({ amount: 12500, status: RefundStatus.Failed }),
    );
    stripe.refunds.create.mockResolvedValue({
      id: 're_2',
      status: 'succeeded',
    });
    const result = await service.refundBooking(userCancellation);
    expect(stripe.refunds.create).toHaveBeenCalledTimes(1);
    expect(result?.status).toBe(RefundStatus.Refunded);
  });

  it("returns 404 for another user's refund", async () => {
    await expect(service.getRefund(USER_ID, 'not-an-id')).rejects.toThrow(
      NotFoundException,
    );
    refundModel.findOne.mockResolvedValue(null);
    await expect(
      service.getRefund(USER_ID, '665f1c2a9b1e8a0012345699'),
    ).rejects.toThrow(NotFoundException);
  });

  it('updates the status from Stripe on a refund webhook', async () => {
    const doc = fakeRefundDoc({
      status: RefundStatus.Pending,
      stripeRefundId: 're_1',
    });
    refundModel.findOne.mockResolvedValue(doc);
    stripe.refunds.retrieve.mockResolvedValue({
      id: 're_1',
      status: 'failed',
      failure_reason: 'expired_or_canceled_card',
    });

    await service.onStripeRefundEvent({ id: 're_1' } as Stripe.Refund);

    expect(doc.status).toBe(RefundStatus.Failed);
    expect(doc.failureReason).toBe('expired_or_canceled_card');
    expect(doc.save).toHaveBeenCalled();
  });
});
