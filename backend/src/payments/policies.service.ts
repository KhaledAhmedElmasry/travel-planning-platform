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
// The policies come from the booking services: flights from AirlinesService.getBookingPolicies()
// (FLT-04, FLT-08, FLT-09), hotels from HotelsService.getBookingPolicies() (HTL-09, HTL-10).
// Accepting also stores a copy of the cancellation tiers on the booking, so a cancellation is
// refunded by the policy the user accepted, even if the provider edits its tiers later
// (PDF 6.4, FLT-26, HTL-21).

export interface PoliciesResponse {
  bookingType: BookingType;
  bookingId: string;
  // Currency of every price in the policies (extraBagPrice), PAY-04.
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

    // The tiers the user is accepting now (the same ones GET policies shows).
    const handler = this.bookings.handlerFor(bookingType);
    const policies = await handler.getBookingPolicies(bookingId);
    if (!policies) throw new NotFoundException('Booking not found.');

    const acceptedAt = new Date();
    const recorded = await handler.recordPolicyAcceptance(
      bookingId,
      acceptedAt,
      policies.cancellationTiers,
    );
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
