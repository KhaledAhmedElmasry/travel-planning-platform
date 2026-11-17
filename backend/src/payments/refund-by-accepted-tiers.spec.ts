import { Types } from 'mongoose';
import { AirlinesService } from '../airlines/airlines.service';
import { BookingStatus } from '../common/enums';
import { FlightBookingLifecycleService } from '../flight-bookings/flight-booking-lifecycle.service';
import { FlightBookingDocument } from '../flight-bookings/schemas/flight-booking.schema';
import { HotelBookingLifecycleService } from '../hotel-bookings/hotel-booking-lifecycle.service';
import { HotelBookingDocument } from '../hotel-bookings/schemas/hotel-booking.schema';
import { HotelsService } from '../hotels/hotels.service';

// PDF 6.4 ("Cancellation and refund calculations must follow the policy applicable to the
// booking"), PAY-02, FLT-26, HTL-21: the refund preview (= the refund cancel() gives) uses the tiers
// the user accepted with the policies, not the provider's tiers of today. Only bookings accepted
// before the copy existed fall back to the provider's current tiers.

const NOW = new Date('2027-03-01T12:00:00Z');
const IN_10_DAYS = new Date('2027-03-11T12:00:00Z');
// The provider changed its policy after the user paid: now 0% at 10 days.
const currentTier = { refundPercentage: 0, tierDaysBefore: null };
// What the user accepted: 7 days or more before -> 50%.
const accepted = [
  { daysBefore: 30, refundPercentage: 100 },
  { daysBefore: 7, refundPercentage: 50 },
];

function flightService(getRefundTier: jest.Mock) {
  const none = undefined as never;
  return new FlightBookingLifecycleService(
    none,
    none,
    none,
    none,
    { getRefundTier } as unknown as AirlinesService,
    none,
    none,
    none,
  );
}

function hotelService(getRefundTier: jest.Mock) {
  const none = undefined as never;
  return new HotelBookingLifecycleService(
    none,
    none,
    none,
    none,
    { getRefundTier } as unknown as HotelsService,
    none,
    none,
    none,
  );
}

function flightBooking(tiers?: typeof accepted) {
  return {
    status: BookingStatus.Confirmed,
    totalAmount: 20000,
    currency: 'USD',
    segments: [{ departureAt: IN_10_DAYS, airlineId: new Types.ObjectId() }],
    acceptedCancellationTiers: tiers,
  } as unknown as FlightBookingDocument;
}

function hotelBooking(tiers?: typeof accepted) {
  return {
    status: BookingStatus.Confirmed,
    totalAmount: 20000,
    currency: 'USD',
    checkIn: new Date('2027-03-11T00:00:00Z'),
    hotelId: new Types.ObjectId(),
    acceptedCancellationTiers: tiers,
  } as unknown as HotelBookingDocument;
}

describe('Refund by the accepted cancellation tiers (PDF 6.4, FLT-26, HTL-21)', () => {
  it('flight: refunds by the accepted tiers, not the airline tiers of today', async () => {
    const getRefundTier = jest.fn().mockResolvedValue(currentTier);
    const preview = await flightService(getRefundTier).previewCancellation(
      flightBooking(accepted),
      NOW,
    );
    expect(preview).toMatchObject({
      cancellable: true,
      refundPercentage: 50,
      tierDaysBefore: 7,
      refundAmount: 10000,
    });
    expect(getRefundTier).not.toHaveBeenCalled();
  });

  it('flight: an accepted empty policy means 0%, not the airline tiers of today', async () => {
    const getRefundTier = jest
      .fn()
      .mockResolvedValue({ refundPercentage: 100, tierDaysBefore: 1 });
    const preview = await flightService(getRefundTier).previewCancellation(
      flightBooking([]),
      NOW,
    );
    expect(preview).toMatchObject({
      refundPercentage: 0,
      tierDaysBefore: null,
    });
    expect(getRefundTier).not.toHaveBeenCalled();
  });

  it('flight: a booking without the copy falls back to the airline tiers', async () => {
    const getRefundTier = jest.fn().mockResolvedValue(currentTier);
    const preview = await flightService(getRefundTier).previewCancellation(
      flightBooking(undefined),
      NOW,
    );
    expect(preview).toMatchObject({ refundPercentage: 0 });
    expect(getRefundTier).toHaveBeenCalledTimes(1);
  });

  it('hotel: refunds by the accepted tiers, not the hotel tiers of today', async () => {
    const getRefundTier = jest.fn().mockResolvedValue(currentTier);
    const preview = await hotelService(getRefundTier).previewCancellation(
      hotelBooking(accepted),
      NOW,
    );
    expect(preview).toMatchObject({
      cancellable: true,
      refundPercentage: 50,
      tierDaysBefore: 7,
      refundAmount: 10000,
    });
    expect(getRefundTier).not.toHaveBeenCalled();
  });

  it('hotel: a reservation without the copy falls back to the hotel tiers', async () => {
    const getRefundTier = jest.fn().mockResolvedValue(currentTier);
    await hotelService(getRefundTier).previewCancellation(
      hotelBooking(undefined),
      NOW,
    );
    expect(getRefundTier).toHaveBeenCalledTimes(1);
  });
});
