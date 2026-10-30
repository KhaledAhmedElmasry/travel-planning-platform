// Area: Hotel Booking & Reviews
//
// TODO: define the Mongoose schema for:
//   Hotel Booking (PDF section 5 "Hotel Bookings"): user, hotel, rooms, stay dates,
//   guests, prices, reference, payment info, status. See HTL-16, HTL-18, GEN-11.
//   Also needed: hold expiry (NEW-01), policy acceptance with timestamp (PAY-02), price per room
//   at booking time (HTL-05). The design must make overlapping holds impossible (HTL-18).
//   PAY-01 (already merged code) reads these fields through HotelBookingsService.findPayableBooking:
//   userId, status (BookingStatus from common/enums), totalAmount (integer cents), currency,
//   holdExpiresAt, policiesAcceptedAt; and confirmPaidBooking stores paymentId + reference.

export {};
