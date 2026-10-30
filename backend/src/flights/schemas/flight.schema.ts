// Area: Airlines & Flight Inventory
//
// TODO: define the Mongoose schema for:
//   Flight and Cabin Inventory (PDF section 5 "Flights"): airline, airports, times,
//   status, cabins with seats and prices. See FLT-03, FLT-04, FLT-30.
//   Seat counters per cabin must allow atomic holds: total, booked, held (FLT-22).
//   Flight number is unique per airline per departure date (FLT-03).
//
// AGREED WITH AREA 1 (already used by flight-bookings/seat-inventory.service.ts, FLT-22/23/26):
// the seat hold updates the "flights" collection directly, so the model must be named "Flight"
// (collection "flights") and keep these field names:
//   status:      'scheduled' | 'cancelled' | 'departed'   (FLT-30; only 'scheduled' can be held)
//   departureAt: Date (UTC)                               (a flight that departed cannot be held)
//   cabins: [{ cabinClass: 'economy' | 'premium_economy' | 'business' | 'first',
//              total: number,   // seat count from the request field "seats" (FLT-04)
//              booked: number,  // confirmed seats, starts at 0
//              held: number,    // seats on hold for unpaid bookings, starts at 0
//              price, freeBags, maxBagWeightKg, ... }]
// Never change booked or held outside seat-inventory.service.ts; FLT-05 must not lower total
// below booked + held.
//
// Effect on existing flight bookings (NEW-02), in the same transaction as the flight change:
//   FLT-05 time change: bookings keep a copy of the times (e-ticket, "before departure" check,
//     refund tier), so update it: FlightBooking.updateMany({ 'segments.flightId': id },
//     { $set: { 'segments.$[s].departureAt': ..., 'segments.$[s].arrivalAt': ... } },
//     { arrayFilters: [{ 's.flightId': id }], session }). Price changes do NOT touch bookings.
//   FLT-06 flight cancelled: every booking with a segment on this flight, as a whole (round trips
//     too, so the OTHER segment's seats are released as well):
//     - confirmed -> cancelled with cancelledAt, SeatInventoryService.releaseBooked() for each
//       segment, and pendingRefund { refundPercentage: 100, tierDaysBefore: null,
//       reason: 'provider_cancellation' } (the every-minute job in
//       flight-booking-lifecycle.service.ts then creates the refund);
//     - pending_payment -> expired with expiredAt, SeatInventoryService.releaseHeld() for each
//       segment, then PaymentsService.cancelPaymentForBooking().

export {};
