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
// Effect on existing flight bookings (NEW-02), in the same transaction as the flight change
// (every status change filtered with status: { $in: allowedFrom(<new status>) } from
// payments/booking-lifecycle.ts, GEN-11):
//   FLT-05 time change: bookings keep a copy of the times (e-ticket, "before departure" check,
//     refund tier), so update it: FlightBooking.updateMany({ 'segments.flightId': id },
//     { $set: { 'segments.$[s].departureAt': ..., 'segments.$[s].arrivalAt': ... } },
//     { arrayFilters: [{ 's.flightId': id }], session }). Price changes do NOT touch bookings.
//   FLT-06 flight cancelled: do NOT change the bookings yourself; Area 1 does it (done):
//       const result = await connection.transaction(async (session) => {
//         // set this flight's status to 'cancelled' (only if it is 'scheduled'), with { session }
//         return lifecycle.cancelBookingsForFlight(flightId, session);
//       });
//       await lifecycle.finishFlightCancellation(result);  // after the commit
//     (lifecycle = FlightBookingLifecycleService, exported by FlightBookingsModule). Every
//     booking with a segment on this flight changes as a whole (round trips too): confirmed ->
//     cancelled with a 100% refund, pending_payment -> expired, seats released on every segment.
//     result.cancelledBookingIds.length is "the number of bookings that were cancelled" of the
//     response.

export {};
