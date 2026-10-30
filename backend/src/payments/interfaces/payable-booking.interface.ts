import { BookingStatus } from '../../common/enums';

// Area: Payments & Refunds
// The contract between PaymentsService and the booking services (PAY-01).
// FlightBookingsService and HotelBookingsService implement BookingPaymentHandler, so payments
// work the same way for both booking types and never read the booking collections directly.

// The booking fields a payment needs.
export interface PayableBooking {
  id: string;
  userId: string;
  status: BookingStatus;
  // Booking total in integer cents of the platform currency (PAY-04, NEW-04).
  totalAmount: number;
  currency: string;
  // End of the 10-minute seat/room hold (FLT-22, HTL-18, NEW-01).
  holdExpiresAt: Date;
  // When the user accepted the provider policies (PAY-02); payment is refused without it.
  policiesAcceptedAt?: Date | null;
}

// Result of confirming a booking after Stripe reported a successful payment:
// - confirmed: the booking moved pending_payment -> confirmed now;
// - already_confirmed: it was confirmed before (Stripe sent the same event twice);
// - not_confirmable: it is no longer pending_payment (e.g. the hold expired), so the payment
//   must be refunded.
export type ConfirmPaidBookingResult =
  'confirmed' | 'already_confirmed' | 'not_confirmable';

export interface BookingPaymentHandler {
  // Returns the booking, or null if it does not exist. Ownership is checked by PaymentsService.
  findPayableBooking(bookingId: string): Promise<PayableBooking | null>;

  // Called by the Stripe webhook only. Must be atomic and safe to call twice.
  confirmPaidBooking(
    bookingId: string,
    paymentId: string,
  ): Promise<ConfirmPaidBookingResult>;
}
