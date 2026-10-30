import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, BookingType } from '../common/enums';
import { BookingGateway } from './booking-gateway.service';
import { BookingPolicies } from './interfaces/payable-booking.interface';
import { platformCurrency } from './platform-currency';

// Area: Payments & Refunds
// PAY-02: before payment the user sees the provider's policies (airline: cancellation tiers and
// baggage; hotel: cancellation tiers and check-in/check-out times) and must accept them. The
// acceptance is stored with a timestamp on the booking; PaymentsService refuses payment without it.
//
// Flights: done in flight-bookings.service.ts (FLT-22); the policies themselves still wait for
// AirlinesService.getBookingPolicies() (Area 5: FLT-08, FLT-09), so GET policies answers 501 until
// then (accepting works).
// Hotels: done in hotel-bookings.service.ts (HTL-18); the policies themselves still wait for
// HotelsService.getBookingPolicies() (Area 7: HTL-09, HTL-10), so GET policies answers 501 until
// then (accepting works).

export interface PoliciesResponse {
  bookingType: BookingType;
  bookingId: string;
  // Currency of every price in the policies (extraBagPrice), PAY-04 / NEW-04.
  currency: string;
  policies: BookingPolicies;
  acceptedAt: Date | null;
}

export interface AcceptPoliciesResponse {
  bookingType: BookingType;
  bookingId: string;
  acceptedAt: Date;
}

@Injectable()
export class PoliciesService {
  constructor(
    private readonly bookings: BookingGateway,
    private readonly config: ConfigService,
  ) {}

  // GET /api/bookings/:type/:id/policies (PAY-02)
  async getPolicies(
    userId: string,
    bookingType: BookingType,
    bookingId: string,
  ): Promise<PoliciesResponse> {
    const booking = await this.bookings.findOwnedBooking(
      userId,
      bookingType,
      bookingId,
    );
    const policies = await this.bookings
      .handlerFor(bookingType)
      .getBookingPolicies(bookingId);
    if (!policies) throw new NotFoundException('Booking not found.');

    return {
      bookingType,
      bookingId,
      currency: platformCurrency(this.config),
      policies,
      acceptedAt: booking.policiesAcceptedAt ?? null,
    };
  }

  // POST /api/bookings/:type/:id/accept-policies (PAY-02)
  async acceptPolicies(
    userId: string,
    bookingType: BookingType,
    bookingId: string,
  ): Promise<AcceptPoliciesResponse> {
    const booking = await this.bookings.findOwnedBooking(
      userId,
      bookingType,
      bookingId,
    );
    // Accepting twice keeps the first acceptance time.
    if (booking.policiesAcceptedAt) {
      return { bookingType, bookingId, acceptedAt: booking.policiesAcceptedAt };
    }
    if (booking.status !== BookingStatus.PendingPayment) {
      throw new ConflictException(
        `This booking is ${booking.status}, not pending payment.`,
      );
    }
    if (booking.holdExpiresAt.getTime() <= Date.now()) {
      throw new ConflictException(
        'The hold on this booking has expired. Please book again.',
      );
    }

    const acceptedAt = new Date();
    const recorded = await this.bookings
      .handlerFor(bookingType)
      .recordPolicyAcceptance(bookingId, acceptedAt);
    if (!recorded) {
      // Accepted by another request at the same moment (a double click): same answer as accepting
      // twice, the first acceptance time.
      const current = await this.bookings.findOwnedBooking(
        userId,
        bookingType,
        bookingId,
      );
      if (current.policiesAcceptedAt) {
        return {
          bookingType,
          bookingId,
          acceptedAt: current.policiesAcceptedAt,
        };
      }
      // Otherwise the hold expired or the booking changed between the checks and the update.
      throw new ConflictException(
        'The booking is no longer pending payment, or its hold has expired.',
      );
    }
    return { bookingType, bookingId, acceptedAt };
  }
}
