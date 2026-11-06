import { BookingStatus, BookingType } from '../../common/enums';

// Area: Payments & Refunds
// The contract between the payments module and the booking services (PAY-01, PAY-02).
// FlightBookingsService and HotelBookingsService implement BookingPaymentHandler, so payments
// and policies work the same way for both booking types and never read the booking
// collections directly.

// The booking fields a payment needs.
export interface PayableBooking {
  id: string;
  userId: string;
  status: BookingStatus;
  // Booking total in integer cents of the platform currency (PAY-04).
  totalAmount: number;
  currency: string;
  // End of the 10-minute seat/room hold (FLT-22, HTL-18, GEN-11).
  holdExpiresAt: Date;
  // When the user accepted the provider policies (PAY-02); payment is refused without it.
  policiesAcceptedAt?: Date | null;
}

// Result of confirming a booking after Stripe reported a successful payment:
// - confirmed: the booking moved pending_payment -> confirmed now;
// - already_confirmed: this payment confirmed it before (Stripe sent the same event twice), even
//   if the booking is completed or cancelled by now (GEN-11): nothing to do;
// - not_confirmable: it is no longer pending_payment and was not confirmed by this payment (e.g. the
//   hold expired), so the payment must be refunded.
export type ConfirmPaidBookingResult =
  'confirmed' | 'already_confirmed' | 'not_confirmable';

// One cancellation tier (FLT-09, HTL-10), as in openapi.yaml "CancellationTier".
export interface CancellationTier {
  daysBefore: number;
  refundPercentage: number;
}

// The tier that applies to a cancellation (FLT-09 rule, also used by HTL-10): returned by
// AirlinesService.getRefundTier() (Area 5) and HotelsService.getRefundTier() (Area 7).
export interface RefundTier {
  refundPercentage: number;
  // daysBefore of the tier used, or null if no tier applies (0%).
  tierDaysBefore: number | null;
}

// The provider policies the user must accept before paying a flight booking (PAY-02):
// the airline's cancellation tiers (FLT-09) and baggage policy (FLT-04, FLT-08).
export interface FlightBookingPolicies {
  bookingType: BookingType.Flight;
  airline: { id: string; name: string };
  cancellationTiers: CancellationTier[];
  baggage: {
    // The free allowance of the booked cabin on each flight (one entry per segment).
    cabins: {
      flightId: string;
      flightNumber: string;
      cabinClass: string;
      freeBags: number;
      maxBagWeightKg: number;
    }[];
    // Integer cents of the platform currency.
    extraBagPrice: number;
    maxExtraBagsPerPassenger: number;
  };
}

// The provider policies the user must accept before paying a hotel reservation (PAY-02):
// the hotel's cancellation tiers (HTL-10) and check-in/check-out times (HTL-09).
export interface HotelBookingPolicies {
  bookingType: BookingType.Hotel;
  hotel: { id: string; name: string };
  cancellationTiers: CancellationTier[];
  checkInTime: string;
  checkOutTime: string;
}

export type BookingPolicies = FlightBookingPolicies | HotelBookingPolicies;

export interface BookingPaymentHandler {
  // Returns the booking, or null if it does not exist. Ownership is checked by BookingGateway.
  findPayableBooking(bookingId: string): Promise<PayableBooking | null>;

  // Called by the Stripe webhook only. Must be atomic and safe to call twice.
  confirmPaidBooking(
    bookingId: string,
    paymentId: string,
  ): Promise<ConfirmPaidBookingResult>;

  // The provider policies that apply to this booking (PAY-02), or null if it does not exist.
  getBookingPolicies(bookingId: string): Promise<BookingPolicies | null>;

  // Stores policiesAcceptedAt on the booking (PAY-02). Must be atomic: only if the booking is
  // still pending_payment and its hold has not expired. Returns false if that is not the case.
  recordPolicyAcceptance(bookingId: string, acceptedAt: Date): Promise<boolean>;
}
