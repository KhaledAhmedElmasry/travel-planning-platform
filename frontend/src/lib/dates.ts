// Calendar dates travel to and from the backend as "YYYY-MM-DD" strings (check-in,
// check-out, itinerary start date, departure date). The pickers work with these
// strings so nothing shifts by a day because of the browser's time zone.

/** Date (local calendar day) -> "2027-03-01" */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "2027-03-01" -> Date at local midnight (or undefined for an empty/invalid value) */
export function fromDateString(value: string | undefined | null): Date | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** "2027-03-01" -> "Mon, 1 Mar 2027" */
export function formatDay(value: string): string {
  const date = fromDateString(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Nights between two "YYYY-MM-DD" dates (check-in -> check-out). */
export function nightsBetween(from: string, to: string): number {
  const a = fromDateString(from);
  const b = fromDateString(to);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Today as "YYYY-MM-DD" in the browser's calendar. */
export function todayString(): string {
  return toDateString(new Date());
}
