import { Injectable, NotImplementedException } from '@nestjs/common';
import type {
  BookingPaymentHandler,
  ConfirmPaidBookingResult,
  PayableBooking,
} from '../payments/interfaces/payable-booking.interface';

// Area: Flight Search & Booking
// Business logic and database access for: FLT-19, FLT-21, FLT-22, FLT-23, FLT-25, FLT-26, GEN-11, NEW-01
// Scheduled jobs needed: expire unpaid 10-minute holds and release seats (FLT-22, NEW-01),
// and mark bookings Completed after the flight (GEN-11).
//
// PAY-01 is waiting for this service. PaymentsService calls the two BookingPaymentHandler
// methods below; they throw 501 until the flight booking schema and the seat hold exist.
@Injectable()
export class FlightBookingsService implements BookingPaymentHandler {
  // TODO: implement.

  // --- Used by PaymentsService (PAY-01) ---

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

  // TODO(NEW-01): the hold-expiry cron (every minute) must, for each pending_payment booking
  // whose holdExpiresAt has passed: set status expired, release the held seats, and call
  // PaymentsService.cancelPaymentForBooking(BookingType.Flight, bookingId) (PAY-01).
  // Needs forwardRef between FlightBookingsModule and PaymentsModule (see payments.module.ts).
}
