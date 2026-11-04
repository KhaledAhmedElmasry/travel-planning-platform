import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { Role } from '../enums';
import type { AuthUser } from '../interfaces';

// Ownership checks for the whole team (ACC-11, PDF section 6.1).
//
// Rules (docs/CONVENTIONS.md "Status Codes"):
//   - Another user's private data            -> 404, so its existence is never revealed.
//   - Logged in, but another airline / hotel -> 403.
//   - Admins may view every booking (ACC-17); moderators the bookings of their own airline or
//     hotel (FLT-29, HTL-22).
//
// These are plain functions: call them in a service after loading the document, with the
// account from @CurrentUser(). Examples:
//
//   // Cancel own booking: owner only.
//   const booking = await this.bookingModel.findById(id);
//   assertOwner(user, booking?.userId, 'Booking not found');
//
//   // View one booking: owner, admin, or the moderator of its airline.
//   assertCanViewBooking(user, booking, 'Booking not found');
//
//   // List bookings: only the ones this account may see.
//   this.bookingModel.find({ ...bookingVisibilityFilter(user), ...otherFilters });
//
//   // Edit a flight: only the moderator of the flight's airline.
//   assertManagesAirline(user, flight.airlineId);
//
//   // Read an itinerary (guests too): public ones for everyone, private ones for the owner.
//   assertCanViewItinerary(user ?? null, itinerary, 'Itinerary not found');

type IdLike = Types.ObjectId | string | null | undefined;

// Two ids are the same document id, whether they are ObjectIds or strings.
export function sameId(a: IdLike, b: IdLike): boolean {
  return !!a && !!b && a.toString() === b.toString();
}

// Own data: only the owner, otherwise 404. Also 404 when the document does not exist
// (pass `doc?.userId`), so "missing" and "someone else's" look the same.
export function assertOwner(
  user: AuthUser,
  ownerId: IdLike,
  notFoundMessage = 'Not found',
): void {
  if (!sameId(user.id, ownerId)) throw new NotFoundException(notFoundMessage);
}

// Provider data (ACC-13): only the moderator assigned to this airline, otherwise 403.
export function assertManagesAirline(user: AuthUser, airlineId: IdLike): void {
  if (
    user.role !== Role.AirlineModerator ||
    !sameId(user.airlineId, airlineId)
  ) {
    throw new ForbiddenException('You can only manage your own airline');
  }
}

// Provider data (ACC-13): only the moderator assigned to this hotel, otherwise 403.
export function assertManagesHotel(user: AuthUser, hotelId: IdLike): void {
  if (user.role !== Role.HotelModerator || !sameId(user.hotelId, hotelId)) {
    throw new ForbiddenException('You can only manage your own hotel');
  }
}

// The owner fields of a flight booking (airline per segment) or a hotel reservation (hotelId).
// A flight booking has one segment for one-way and two for a round trip, and each segment
// stores its own airlineId, so the two legs can belong to different airlines (FLT-12).
export interface BookingOwnership {
  userId: IdLike;
  segments?: { airlineId?: IdLike }[];
  hotelId?: IdLike;
}

// Who may view a booking: its owner, an admin (ACC-17), or the moderator of its airline
// (FLT-29: any segment of the booking is on their airline) or hotel (HTL-22).
export function canViewBooking(
  user: AuthUser,
  booking: BookingOwnership,
): boolean {
  switch (user.role) {
    case Role.Admin:
      return true;
    case Role.AirlineModerator:
      return (
        booking.segments?.some((segment) =>
          sameId(user.airlineId, segment.airlineId),
        ) ?? false
      );
    case Role.HotelModerator:
      return sameId(user.hotelId, booking.hotelId);
    default:
      return sameId(user.id, booking.userId);
  }
}

// View one booking, otherwise 404 (also when it does not exist: pass null).
export function assertCanViewBooking(
  user: AuthUser,
  booking: BookingOwnership | null | undefined,
  notFoundMessage = 'Booking not found',
): void {
  if (!booking || !canViewBooking(user, booking)) {
    throw new NotFoundException(notFoundMessage);
  }
}

// A MongoDB filter for booking lists: admin everything, a user their own, a moderator the
// bookings of their airline or hotel. A moderator without an assigned provider sees nothing.
// Use it on flight bookings (the airline is stored per segment: segments.airlineId) and on
// hotel reservations (hotelId).
export function bookingVisibilityFilter(
  user: AuthUser,
): Record<string, Types.ObjectId | null> {
  switch (user.role) {
    case Role.Admin:
      return {};
    case Role.AirlineModerator:
      return user.airlineId
        ? { 'segments.airlineId': new Types.ObjectId(user.airlineId) }
        : { _id: null };
    case Role.HotelModerator:
      return user.hotelId
        ? { hotelId: new Types.ObjectId(user.hotelId) }
        : { _id: null };
    default:
      return { userId: new Types.ObjectId(user.id) };
  }
}

// The fields of an itinerary that decide who may read it (ITN-20, GEN-10).
export interface ItineraryVisibility {
  userId: IdLike;
  visibility: 'public' | 'private';
  hidden?: boolean;
}

// Public and not hidden: everyone, guests included (pass null). Otherwise only the owner.
// ACC-11 makes no admin exception for private itineraries.
export function canViewItinerary(
  user: AuthUser | null,
  itinerary: ItineraryVisibility,
): boolean {
  if (itinerary.visibility === 'public' && !itinerary.hidden) return true;
  return !!user && sameId(user.id, itinerary.userId);
}

// Read one itinerary, otherwise 404 (also when it does not exist: pass null).
export function assertCanViewItinerary(
  user: AuthUser | null,
  itinerary: ItineraryVisibility | null | undefined,
  notFoundMessage = 'Itinerary not found',
): void {
  if (!itinerary || !canViewItinerary(user, itinerary)) {
    throw new NotFoundException(notFoundMessage);
  }
}
