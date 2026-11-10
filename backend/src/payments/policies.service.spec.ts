import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, BookingType } from '../common/enums';
import { FlightBookingsService } from '../flight-bookings/flight-bookings.service';
import { HotelBookingsService } from '../hotel-bookings/hotel-bookings.service';
import { BookingGateway } from './booking-gateway.service';
import {
  FlightBookingPolicies,
  PayableBooking,
} from './interfaces/payable-booking.interface';
import { PoliciesService } from './policies.service';

// PAY-02 unit tests (PoliciesService). The booking service is faked.

const USER_ID = '665f1c2a9b1e8a0012345601';
const BOOKING_ID = '665f1c2a9b1e8a0012345602';

function booking(overrides: Partial<PayableBooking> = {}): PayableBooking {
  return {
    id: BOOKING_ID,
    userId: USER_ID,
    status: BookingStatus.PendingPayment,
    totalAmount: 25000,
    currency: 'USD',
    holdExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    policiesAcceptedAt: null,
    ...overrides,
  };
}

const flightPolicies: FlightBookingPolicies = {
  bookingType: BookingType.Flight,
  airline: { id: 'airline-1', name: 'Nile Air' },
  cancellationTiers: [
    { daysBefore: 30, refundPercentage: 100 },
    { daysBefore: 7, refundPercentage: 50 },
  ],
  baggage: {
    cabins: [
      {
        flightId: 'flight-1',
        flightNumber: 'NA100',
        cabinClass: 'economy',
        freeBags: 1,
        maxBagWeightKg: 23,
      },
    ],
    extraBagPrice: 3000,
    maxExtraBagsPerPassenger: 2,
  },
};

describe('PoliciesService (PAY-02)', () => {
  let service: PoliciesService;
  let flightBookings: Record<string, jest.Mock>;

  beforeEach(() => {
    flightBookings = {
      findPayableBooking: jest.fn().mockResolvedValue(booking()),
      getBookingPolicies: jest.fn().mockResolvedValue(flightPolicies),
      recordPolicyAcceptance: jest.fn().mockResolvedValue(true),
    };
    const config = { getOrThrow: () => 'USD' };
    service = new PoliciesService(
      new BookingGateway(
        flightBookings as unknown as FlightBookingsService,
        {} as HotelBookingsService,
      ),
      config as unknown as ConfigService,
    );
  });

  it('shows the airline policies with the currency and no acceptance yet', async () => {
    const result = await service.getPolicies(
      USER_ID,
      BookingType.Flight,
      BOOKING_ID,
    );
    expect(result).toEqual({
      bookingType: BookingType.Flight,
      bookingId: BOOKING_ID,
      currency: 'USD',
      policies: flightPolicies,
      acceptedAt: null,
    });
  });

  it("returns 404 for another user's booking", async () => {
    flightBookings.findPayableBooking.mockResolvedValue(
      booking({ userId: '665f1c2a9b1e8a0012345699' }),
    );
    await expect(
      service.getPolicies(USER_ID, BookingType.Flight, BOOKING_ID),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.acceptPolicies(USER_ID, BookingType.Flight, BOOKING_ID),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns 404 for an invalid id without calling the booking service', async () => {
    await expect(
      service.getPolicies(USER_ID, BookingType.Flight, 'abc'),
    ).rejects.toThrow(NotFoundException);
    expect(flightBookings.findPayableBooking).not.toHaveBeenCalled();
  });

  it('records the acceptance with a timestamp', async () => {
    const before = Date.now();
    const result = await service.acceptPolicies(
      USER_ID,
      BookingType.Flight,
      BOOKING_ID,
    );
    const [id, acceptedAt] = flightBookings.recordPolicyAcceptance.mock
      .calls[0] as [string, Date];
    expect(id).toBe(BOOKING_ID);
    expect(acceptedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.acceptedAt).toBe(acceptedAt);
  });

  it('keeps the first acceptance time when accepted twice', async () => {
    const first = new Date('2026-11-01T10:00:00Z');
    flightBookings.findPayableBooking.mockResolvedValue(
      booking({ policiesAcceptedAt: first }),
    );
    const result = await service.acceptPolicies(
      USER_ID,
      BookingType.Flight,
      BOOKING_ID,
    );
    expect(result.acceptedAt).toBe(first);
    expect(flightBookings.recordPolicyAcceptance).not.toHaveBeenCalled();
  });

  it('returns 409 when the hold has expired', async () => {
    flightBookings.findPayableBooking.mockResolvedValue(
      booking({ holdExpiresAt: new Date(Date.now() - 1000) }),
    );
    await expect(
      service.acceptPolicies(USER_ID, BookingType.Flight, BOOKING_ID),
    ).rejects.toThrow(ConflictException);
  });

  it('returns 409 when the booking is not pending payment', async () => {
    flightBookings.findPayableBooking.mockResolvedValue(
      booking({ status: BookingStatus.Expired }),
    );
    await expect(
      service.acceptPolicies(USER_ID, BookingType.Flight, BOOKING_ID),
    ).rejects.toThrow(ConflictException);
  });

  it('returns 409 when the hold expires during the update', async () => {
    flightBookings.recordPolicyAcceptance.mockResolvedValue(false);
    await expect(
      service.acceptPolicies(USER_ID, BookingType.Flight, BOOKING_ID),
    ).rejects.toThrow(ConflictException);
  });

  it('returns the first time when another request accepted at the same moment', async () => {
    const first = new Date('2026-11-01T10:00:00Z');
    flightBookings.findPayableBooking
      .mockResolvedValueOnce(booking())
      .mockResolvedValueOnce(booking({ policiesAcceptedAt: first }));
    flightBookings.recordPolicyAcceptance.mockResolvedValue(false);
    const result = await service.acceptPolicies(
      USER_ID,
      BookingType.Flight,
      BOOKING_ID,
    );
    expect(result.acceptedAt).toBe(first);
  });
});
