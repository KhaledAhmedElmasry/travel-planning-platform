// Area: Payments, Holds & Booking Engine
// Requirements: HTL-11, HTL-16, HTL-18, HTL-21
// Stay dates are calendar dates ("2026-12-01"), not moments in time. They are stored as a Date at
// 00:00 UTC, so a server or user time zone can never move them to another day. A stay from
// checkIn to checkOut has one night per date from checkIn up to the day before checkOut.
// Area 7's hotel search (HTL-11, HTL-15) should use the same helpers, so "check-in in the past"
// and "free for the whole stay" mean the same thing everywhere.

const DAY_MS = 24 * 60 * 60 * 1000;

// "2026-12-01" -> 2026-12-01T00:00:00.000Z (the text is already checked as YYYY-MM-DD).
export function dateOnly(text: string): Date {
  return new Date(`${text}T00:00:00.000Z`);
}

// 2026-12-01T00:00:00.000Z -> "2026-12-01"
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Today's date (UTC), as a Date at 00:00 UTC.
export function todayUtc(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

// Whole calendar days from one date to another (both at 00:00 UTC).
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

// Every night of the stay: checkIn, checkIn + 1 day, ..., checkOut - 1 day.
export function stayNights(checkIn: Date, checkOut: Date): Date[] {
  const nights: Date[] = [];
  for (let t = checkIn.getTime(); t < checkOut.getTime(); t += DAY_MS) {
    nights.push(new Date(t));
  }
  return nights;
}

// HTL-10, HTL-21: whole days left before the check-in date, used to pick the hotel's tier. The
// refund preview in the reservation details (HTL-20; Area 6) must use this too, so the amount
// shown before cancelling is the amount refunded.
export function daysBeforeCheckIn(checkIn: Date, now = new Date()): number {
  return daysBetween(todayUtc(now), checkIn);
}
