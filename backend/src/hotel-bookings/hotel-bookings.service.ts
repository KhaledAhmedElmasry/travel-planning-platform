import { Injectable, NotImplementedException } from '@nestjs/common';
import type {
  BookingPaymentHandler,
  BookingPolicies,
  ConfirmPaidBookingResult,
  PayableBooking,
} from '../payments/interfaces/payable-booking.interface';

// Area: Hotel Booking & Reviews
// Business logic and database access for: HTL-16, HTL-17, HTL-18, HTL-20, HTL-21, GEN-11, NEW-01
// Scheduled jobs needed: expire unpaid 10-minute holds and release rooms (HTL-18, NEW-01),
// and mark reservations Completed after check-out (HTL-23, GEN-11).
//
// PAY-01, PAY-02 and PAY-03 are waiting for this service. The payments module calls the four
// BookingPaymentHandler methods below; they throw 501 until the hotel booking schema and the
// room hold exist.
// TODO(HTL-21): cancelling a Confirmed reservation must call RefundsService.refundBooking() with
// the hotel tier for the days left before check-in, on the full total (reason
// user_cancellation, tierDaysBefore). Reservation details (HTL-20) show
// RefundsService.findRefundForBooking() and policiesAcceptedAt.
@Injectable()
export class HotelBookingsService implements BookingPaymentHandler {
  // TODO: implement.

  // --- Used by the payments module (PAY-01, PAY-02) ---

  // WAITING FOR: hotel-booking.schema.ts and the room hold (HTL-16, HTL-18), and
  // policiesAcceptedAt set by PAY-02.
  // TODO(HTL-18): when the schema exists:
  //   1. inject the HotelBooking model;
  //   2. find the reservation by id; return null if not found (do NOT check the user here,
  //      PaymentsService does);
  //   3. map it to PayableBooking: id, userId, status, totalAmount (integer cents of the
  //      platform currency, all rooms and nights), currency, holdExpiresAt, policiesAcceptedAt.
  findPayableBooking(_bookingId: string): Promise<PayableBooking | null> {
    throw new NotImplementedException(
      'Hotel bookings are not implemented yet (HTL-16, HTL-18).',
    );
  }

  // WAITING FOR: the room hold (HTL-18) and room/availability schemas (Area 7, HTL-03, HTL-04).
  // TODO(HTL-17): called by the Stripe webhook after a verified successful payment.
  //   1. Atomically move the reservation pending_payment -> confirmed only if it is still
  //      pending_payment (findOneAndUpdate with { status: 'pending_payment' } in the filter),
  //      store paymentId and a unique booking reference. All its rooms are confirmed together.
  //   2. Turn the held room-nights into booked ones (depends on the HTL-18 hold design).
  //   3. Return 'confirmed'. If it is already confirmed return 'already_confirmed' (Stripe may
  //      send the event twice). If it is expired/cancelled return 'not_confirmable' and
  //      PaymentsService refunds the payment.
  //   4. Notify the user (GEN-01, Area 3 NotificationsService) once it exists.
  confirmPaidBooking(
    _bookingId: string,
    _paymentId: string,
  ): Promise<ConfirmPaidBookingResult> {
    throw new NotImplementedException(
      'Hotel booking confirmation is not implemented yet (HTL-17).',
    );
  }

  // WAITING FOR: the hotel reservation (HTL-16, HTL-18) and the hotel's policies: check-in and
  // check-out times (HTL-09) and cancellation tiers (HTL-10), both Area 7.
  // TODO(PAY-02): find the reservation by id (null if not found) and return HotelBookingPolicies:
  //   bookingType 'hotel', the hotel (id, name), its cancellationTiers sorted by daysBefore
  //   (highest first), checkInTime and checkOutTime (HH:mm).
  getBookingPolicies(_bookingId: string): Promise<BookingPolicies | null> {
    throw new NotImplementedException(
      'Hotel bookings are not implemented yet (HTL-16, HTL-18).',
    );
  }

  // WAITING FOR: hotel-booking.schema.ts with policiesAcceptedAt (HTL-18).
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
      'Hotel bookings are not implemented yet (HTL-16, HTL-18).',
    );
  }

  // TODO(NEW-01): the hold-expiry cron (every minute) must, for each pending_payment reservation
  // whose holdExpiresAt has passed: set status expired, release the held room-nights, and call
  // PaymentsService.cancelPaymentForBooking(BookingType.Hotel, bookingId) (PAY-01).
  // Needs forwardRef between HotelBookingsModule and PaymentsModule (see payments.module.ts).
}
