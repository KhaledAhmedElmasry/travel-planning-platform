import { BookingStatus } from '../common/enums';

// Area: Payments, Holds & Booking Engine
// GEN-11: the ONLY status changes of flight bookings and hotel reservations.
//   pending_payment -> confirmed   payment succeeded (FLT-23, HTL-17)
//   pending_payment -> expired     the 10-minute hold ended unpaid (FLT-22, HTL-18, NEW-01)
//   confirmed       -> completed   the last flight departed / the check-out date passed (NEW-01)
//   confirmed       -> cancelled   cancelled by the user (FLT-26, HTL-21) or the provider (FLT-06)
// completed, expired and cancelled are final: nothing can change them.
//
// Every status change is ONE conditional update whose filter contains
//   status: { $in: allowedFrom(<new status>) }
// so MongoDB itself refuses any other change, also when two changes happen at the same moment
// (e.g. a late payment and the expiry job). Code of other areas that changes a booking status
// (FLT-06 flight cancellation, Area 5) must do the same.
export const BOOKING_TRANSITIONS: Readonly<
  Record<BookingStatus, readonly BookingStatus[]>
> = {
  [BookingStatus.PendingPayment]: [
    BookingStatus.Confirmed,
    BookingStatus.Expired,
  ],
  [BookingStatus.Confirmed]: [BookingStatus.Completed, BookingStatus.Cancelled],
  [BookingStatus.Completed]: [],
  [BookingStatus.Expired]: [],
  [BookingStatus.Cancelled]: [],
};

// true if a booking with status `from` may move to `to`.
export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

// The statuses a booking may have now to move to `to`.
// Example: allowedFrom(BookingStatus.Cancelled) -> ['confirmed'].
export function allowedFrom(to: BookingStatus): BookingStatus[] {
  return (Object.keys(BOOKING_TRANSITIONS) as BookingStatus[]).filter((from) =>
    canTransition(from, to),
  );
}
