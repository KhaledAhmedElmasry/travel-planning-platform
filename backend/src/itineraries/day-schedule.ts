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
  _id?: { toString(): string };
  number: number;
  date: Date;
  cityId?: string;
}

export interface CityGroupDay {
  cityId: string;
  firstDay: number;
  lastDay: number;
  dayCount: number;
  dayNumbers: number[];
  dayIds: string[];
  startDate: string;
  endDate: string;
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

export function computeCityGroups(days: ScheduledDay[]): CityGroupDay[] {
  const groups: CityGroupDay[] = [];

  for (const day of days) {
    const cityId = day.cityId ?? '';
    const previous = groups[groups.length - 1];
    if (previous?.cityId === cityId) {
      previous.lastDay = day.number;
      previous.dayCount += 1;
      previous.dayNumbers.push(day.number);
      if (day._id) previous.dayIds.push(day._id.toString());
      previous.endDate = toDateString(day.date);
      continue;
    }

    groups.push({
      cityId,
      firstDay: day.number,
      lastDay: day.number,
      dayCount: 1,
      dayNumbers: [day.number],
      dayIds: day._id ? [day._id.toString()] : [],
      startDate: toDateString(day.date),
      endDate: toDateString(day.date),
    });
  }

  return groups;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
