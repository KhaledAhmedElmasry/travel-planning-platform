// Area: Hotels & Rooms
//
// TODO: define the Mongoose schema for:
//   Room and Room Availability (PDF section 5 "Hotels"): room number, type, beds,
//   occupancy, price, bookable ranges, blocked dates. See HTL-03..HTL-06.
//   Also needed: active / deactivated flag (HTL-06); room number unique within the hotel (HTL-03).
//
// AGREED WITH AREA 1 (already used by hotel-bookings/hotel-bookings.service.ts, HTL-16/18):
// reservations read the "rooms" collection directly, so the model must be named "Room"
// (collection "rooms") and keep these field names:
//   hotelId:        ObjectId of the hotel
//   roomNumber:     string, type: string, beds: number, maxOccupancy: number (>= 1)
//   pricePerNight:  integer cents of the platform currency (> 0)
//   active:         boolean, default true (HTL-06: false = deactivated, cannot be booked)
//   availableRanges: [{ from: Date, to: Date }]  bookable nights (HTL-04), both INCLUDED
//   blockedRanges:   [{ from: Date, to: Date }]  blocked nights (HTL-06), both INCLUDED
//   lastReservedAt: Date | null      written by Area 1 on every hold; keep it in the schema
// Dates are calendar dates stored at 00:00 UTC: use dateOnly() from hotel-bookings/stay-dates.ts.
// A stay is bookable only if EVERY night (checkIn .. checkOut - 1 day) is inside an available
// range and outside every blocked range.
// Why Area 1 writes lastReservedAt: the hold transaction reads the room and then writes it, so a
// block, deactivation or availability change saved at the same moment makes one of the two
// transactions retry (MongoDB write conflict) and see the other's change. So do every room change
// in a transaction that also checks RoomInventoryService.findTakenNights() (HTL-05, HTL-06), and
// never delete a room that appears in a reservation (hotelbookings "rooms.roomId", HTL-06).

export {};
