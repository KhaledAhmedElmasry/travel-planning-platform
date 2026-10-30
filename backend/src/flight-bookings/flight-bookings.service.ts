import { Injectable, NotImplementedException } from '@nestjs/common';
import type {
  BookingPaymentHandler,
  BookingPolicies,
  ConfirmPaidBookingResult,
  PayableBooking,
} from '../payments/interfaces/payable-booking.interface';

// Area: Flight Search & Booking
// Business logic and database access for: FLT-19, FLT-21, FLT-22, FLT-23, FLT-25, FLT-26, GEN-11, NEW-01
// Scheduled jobs needed: expire unpaid 10-minute holds and release seats (FLT-22, NEW-01),
// and mark bookings Completed after the flight (GEN-11).
//
// PAY-01, PAY-02 and PAY-03 are waiting for this service. The payments module calls the four
// BookingPaymentHandler methods below; they throw 501 until the flight booking schema and the
// seat hold exist.
// TODO(FLT-26): cancelling a Confirmed booking must call RefundsService.refundBooking() with the
// airline tier for the days left before departure (reason user_cancellation, tierDaysBefore).
// Booking details (FLT-25) show RefundsService.findRefundForBooking() and policiesAcceptedAt.
@Injectable()
export class FlightBookingsService implements BookingPaymentHandler {
  // TODO: implement.

  // --- Used by the payments module (PAY-01, PAY-02) ---

  // WAITING FOR: flight-booking.schema.ts and the seat hold (FLT-22), and policiesAcceptedAt
  // set by PAY-02.
  // TODO(FLT-22): when the schema exists:
  //   1. inject the FlightBooking model;
  //   2. find the booking by id; return null if not found (do NOT check the user here,
  //      PaymentsService does);
  //   3. map it to PayableBooking: id, userId, status, totalAmount (integer cents of the
  //      platform currency), currency, holdExpiresAt, policiesAcceptedAt.
  findPayableBooking(_bookingId: string): Promise<PayableBooking | null> {
    throw new NotImplementedException(
      'Flight bookings are not implemented yet (FLT-22).',
    );
  }

  // WAITING FOR: the seat hold (FLT-22) and cabin counters total/booked/held (Area 5, FLT-04).
  // TODO(FLT-23): called by the Stripe webhook after a verified successful payment.
  //   1. Atomically move the booking pending_payment -> confirmed only if it is still
  //      pending_payment (findOneAndUpdate with { status: 'pending_payment' } in the filter),
  //      store paymentId and a unique booking reference (FLT-23).
  //   2. In the cabin of every flight segment: held -= n and booked += n (same atomic style
  //      as the hold).
  //   3. Return 'confirmed'. If the booking is already confirmed return 'already_confirmed'
  //      (Stripe may send the event twice). If it is expired/cancelled return 'not_confirmable'
  //      and PaymentsService refunds the payment.
  //   4. Notify the user (GEN-01, Area 3 NotificationsService) once it exists.
  confirmPaidBooking(
    _bookingId: string,
    _paymentId: string,
  ): Promise<ConfirmPaidBookingResult> {
    throw new NotImplementedException(
      'Flight booking confirmation is not implemented yet (FLT-23).',
    );
  }

  // WAITING FOR: the flight booking (FLT-22) and the airline's policies: cancellation tiers
  // (FLT-09), extra-bag price and maximum (FLT-08), free bags and max weight per cabin (FLT-04),
  // all Area 5.
  // TODO(PAY-02): find the booking by id (null if not found) and return FlightBookingPolicies:
  //   bookingType 'flight', the airline (id, name), its cancellationTiers sorted by daysBefore
  //   (highest first), and baggage: for each booked segment the flight id/number, cabinClass,
  //   freeBags and maxBagWeightKg of that cabin, plus extraBagPrice (cents) and
  //   maxExtraBagsPerPassenger.
  getBookingPolicies(_bookingId: string): Promise<BookingPolicies | null> {
    throw new NotImplementedException(
      'Flight bookings are not implemented yet (FLT-22).',
    );
  }

  // WAITING FOR: flight-booking.schema.ts with policiesAcceptedAt (FLT-22).
  // TODO(PAY-02): one atomic update, so a hold that expires at the same moment cannot be accepted:
  //   findOneAndUpdate(
  //     { _id: bookingId, status: 'pending_payment', holdExpiresAt: { $gt: acceptedAt } },
  //     { $set: { policiesAcceptedAt: acceptedAt } })
  //   and return true if a document was updated, false otherwise.
  recordPolicyAcceptance(
    _bookingId: string,
    _acceptedAt: Date,
  ): Promise<boolean> {
    throw new NotImplementedException(
      'Flight bookings are not implemented yet (FLT-22).',
    );
  }

  // TODO(NEW-01): the hold-expiry cron (every minute) must, for each pending_payment booking
  // whose holdExpiresAt has passed: set status expired, release the held seats, and call
  // PaymentsService.cancelPaymentForBooking(BookingType.Flight, bookingId) (PAY-01).
  // Needs forwardRef between FlightBookingsModule and PaymentsModule (see payments.module.ts).
}
