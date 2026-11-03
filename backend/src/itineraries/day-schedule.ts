// Area: Itineraries
// Requirements: ITN-05, ITN-07, ITN-08, ITN-09
// The single place that decides a day's number and date. Days are numbered 1, 2, 3, ... in array
// order and day N's date is the itinerary start date plus N-1 days. Every change to the days
// (add and edit in ITN-05, delete in ITN-07, reorder in ITN-08) and every start date change
// (ITN-01) calls renumberDays afterwards, so the numbers stay consecutive and the dates never
// drift. ITN-09 builds the city groups from the days in this order.

const DAY_MS = 24 * 60 * 60 * 1000;

// ITN-05: an itinerary has at most 60 days (openapi.yaml, POST /api/itineraries/{id}/days).
export const MAX_ITINERARY_DAYS = 60;

export interface ScheduledDay {
  number: number;
  date: Date;
}

// Day N (1-based) of an itinerary starting at startDate (00:00 UTC) -> startDate + N-1 days.
export function dayDate(startDate: Date, dayNumber: number): Date {
  return new Date(startDate.getTime() + (dayNumber - 1) * DAY_MS);
}

// Sets number = position (1-based) and date = start date + position - 1 for every day, in the
// current array order. Mutates and returns the same array, so it works on a Mongoose document
// array before save().
export function renumberDays<T extends ScheduledDay>(
  days: T[],
  startDate: Date,
): T[] {
  days.forEach((day, index) => {
    day.number = index + 1;
    day.date = dayDate(startDate, index + 1);
  });
  return days;
}
