import { BadRequestException } from '@nestjs/common';
import { dateOnly, formatDate } from '../hotel-bookings/stay-dates';

// Area: Hotels & Rooms (HTL-05, HTL-06)
// Date-range math for a room's bookable and blocked nights. A range is a run of nights stored at
// 00:00 UTC with BOTH ends included (agreed with Area 1, see schemas/room.schema.ts).

export interface NightRange {
  from: Date;
  to: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// "2027-03-01" -> that date at 00:00 UTC, or 400 if it is not a real date (2027-02-30).
export function parseNight(text: string, field: string): Date {
  const date = dateOnly(text);
  if (Number.isNaN(date.getTime()) || formatDate(date) !== text) {
    throw new BadRequestException(`${field} is not a valid date: "${text}".`);
  }
  return date;
}

// The request's from / to as a range, or 400 if to is before from.
export function parseNightRange(from: string, to: string): NightRange {
  const range = { from: parseNight(from, 'from'), to: parseNight(to, 'to') };
  if (range.to < range.from) {
    throw new BadRequestException(
      'Invalid dates: "to" must not be before "from".',
    );
  }
  return range;
}

export function overlaps(a: NightRange, b: NightRange): boolean {
  return a.from <= b.to && b.from <= a.to;
}

// Every range minus the nights of cut. A range that contains cut is split in two.
export function subtractRange(
  ranges: NightRange[],
  cut: NightRange,
): NightRange[] {
  const result: NightRange[] = [];
  for (const r of ranges) {
    if (!overlaps(r, cut)) {
      result.push({ from: r.from, to: r.to });
      continue;
    }
    if (r.from < cut.from) {
      result.push({ from: r.from, to: addDays(cut.from, -1) });
    }
    if (r.to > cut.to) {
      result.push({ from: addDays(cut.to, 1), to: r.to });
    }
  }
  return sortRanges(result);
}

export function sortRanges(ranges: NightRange[]): NightRange[] {
  return [...ranges].sort((a, b) => a.from.getTime() - b.from.getTime());
}

export function formatRanges(ranges: NightRange[]) {
  return ranges.map((r) => ({
    from: formatDate(r.from),
    to: formatDate(r.to),
  }));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}
