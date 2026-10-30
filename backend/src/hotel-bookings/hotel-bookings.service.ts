import { Injectable, NotImplementedException } from '@nestjs/common';
import type {
  BookingPaymentHandler,
  ConfirmPaidBookingResult,
  PayableBooking,
} from '../payments/interfaces/payable-booking.interface';

// Area: Hotel Booking & Reviews
// Business logic and database access for: HTL-16, HTL-17, HTL-18, HTL-20, HTL-21, GEN-11, NEW-01
// Scheduled jobs needed: expire unpaid 10-minute holds and release rooms (HTL-18, NEW-01),
// and mark reservations Completed after check-out (HTL-23, GEN-11).
//
// PAY-01 is waiting for this service. PaymentsService calls the two BookingPaymentHandler
// methods below; they throw 501 until the hotel booking schema and the room hold exist.
@Injectable()
export class HotelBookingsService implements BookingPaymentHandler {
  // TODO: implement.

  // --- Used by PaymentsService (PAY-01) ---

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

  // TODO(NEW-01): the hold-expiry cron (every minute) must, for each pending_payment reservation
  // whose holdExpiresAt has passed: set status expired, release the held room-nights, and call
  // PaymentsService.cancelPaymentForBooking(BookingType.Hotel, bookingId) (PAY-01).
  // Needs forwardRef between HotelBookingsModule and PaymentsModule (see payments.module.ts).
}
