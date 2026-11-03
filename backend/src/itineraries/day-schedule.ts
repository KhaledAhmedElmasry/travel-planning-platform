// Area: Itineraries
// Requirements: ITN-05, ITN-07, ITN-08, ITN-09
// The single place that decides a day's number and date. Days are numbered 1, 2, 3, ... in array
// order and day N's date is the itinerary start date plus N-1 days. Every change to the days
// (add and edit in ITN-05, delete in ITN-07, reorder in ITN-08) and every start date change
// (ITN-01) calls renumberDays afterwards, so the numbers stay consecutive and the dates never
// drift. ITN-09: computeCityGroups builds the city groups from the days in this order; the groups
// are derived, never stored, so they are rebuilt from the freshly renumbered days every time.

import type { Types } from 'mongoose';

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

// ITN-09: a day as the city grouping reads it. _id is optional so the grouping can be tested
// with plain objects; Mongoose subdocuments always have it.
export interface CityGroupDay extends ScheduledDay {
  _id?: Types.ObjectId | string;
  cityId: string;
}

// ITN-09: one run of consecutive days in the same city. Keep these fields stable: Area 6
// (GET /api/itineraries/:id/hotels, ITN-25) finds the group of a day by dayIds and uses cityId,
// startDate (check-in) and endDate (check-out is the day after). ITN-14 adds the budget subtotal.
export interface CityGroup {
  cityId: string;
  firstDay: number;
  lastDay: number;
  dayCount: number;
  dayNumbers: number[];
  dayIds: string[];
  // Dates of the first and last day, as ISO calendar dates (YYYY-MM-DD).
  startDate: string;
  endDate: string;
}

// ITN-09: groups consecutive days with the same city, in array order. Only neighbours are
// merged, so Cairo, Cairo, Luxor, Cairo, Cairo gives three groups, not two. Call it on days that
// renumberDays has just ordered (every day change does), so the groups always match the days.
export function computeCityGroups(days: readonly CityGroupDay[]): CityGroup[] {
  const groups: CityGroup[] = [];
  for (const day of days) {
    const date = day.date.toISOString().slice(0, 10);
    const dayId = day._id === undefined ? '' : String(day._id);
    const current = groups[groups.length - 1];
    if (current && current.cityId === day.cityId) {
      current.lastDay = day.number;
      current.dayCount += 1;
      current.dayNumbers.push(day.number);
      if (dayId) current.dayIds.push(dayId);
      current.endDate = date;
    } else {
      groups.push({
        cityId: day.cityId,
        firstDay: day.number,
        lastDay: day.number,
        dayCount: 1,
        dayNumbers: [day.number],
        dayIds: dayId ? [dayId] : [],
        startDate: date,
        endDate: date,
      });
    }
  }
  return groups;
}
