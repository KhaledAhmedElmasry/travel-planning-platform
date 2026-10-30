// Area: Hotels & Rooms
//
// TODO: define the Mongoose schema for:
//   Hotel and Hotel Policy (PDF section 5 "Hotels"): profile, photos, amenities,
//   check-in/out times, cancellation tiers. See HTL-01, HTL-09, HTL-10.
//   Also needed: city and country by official id (NEW-05), active / deactivated status (ACC-15),
//   average rating and rating count kept up to date by reviews (HTL-12, HTL-23, HTL-24).
//
// AGREED WITH AREA 1 (already used by hotel-bookings/hotel-bookings.service.ts, HTL-16/18):
// reservations read the "hotels" collection directly, so the model must be named "Hotel"
// (collection "hotels") and keep these field names:
//   name:   string                    (copied into the reservation)
//   active: boolean, default true     (ACC-15: false = deactivated, cannot be booked -> 404)
// Policies and tiers are read through HotelsService.getBookingPolicies() / getRefundTier().

export {};
