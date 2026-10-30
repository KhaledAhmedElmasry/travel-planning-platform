// Area: Flight Search & Booking
//
// TODO: define the Mongoose schema for:
//   Flight Booking and Passenger (PDF section 5 "Flight Bookings"): user, flights,
//   passengers, baggage, agreed prices, reference, payment info, status.
//   See FLT-12, FLT-19, FLT-22, FLT-23, GEN-11.
//   Also needed: one or two segments (round trip, FLT-12), passenger type, hold expiry (NEW-01),
//   policy acceptance with timestamp (PAY-02), prices agreed at booking time (NEW-02).
//   PAY-01 (already merged code) reads these fields through FlightBookingsService.findPayableBooking:
//   userId, status (BookingStatus from common/enums), totalAmount (integer cents), currency,
//   holdExpiresAt, policiesAcceptedAt; and confirmPaidBooking stores paymentId + reference.
//
// Bonus FLT-27 / FLT-28: changed flight history and seat numbers per passenger.

export {};
