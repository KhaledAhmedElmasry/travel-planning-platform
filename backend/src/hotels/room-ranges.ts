import { BadRequestException } from '@nestjs/common';
import {
  dateOnly,
  formatDate,
  stayNights,
  todayUtc,
} from '../hotel-bookings/stay-dates';

// Area: Hotels & Rooms (HTL-05, HTL-06, HTL-15)
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

// The ranges plus add, joined with every range it overlaps or touches, so the result never has
// two ranges that overlap (e.g. 1-5 and 6-9 become 1-9).
export function addRange(ranges: NightRange[], add: NightRange): NightRange[] {
  let from = add.from;
  let to = add.to;
  const rest: NightRange[] = [];
  for (const r of ranges) {
    const touches = r.from <= addDays(to, 1) && addDays(from, -1) <= r.to;
    if (touches) {
      if (r.from < from) from = r.from;
      if (r.to > to) to = r.to;
    } else {
      rest.push({ from: r.from, to: r.to });
    }
  }
  return sortRanges([...rest, { from, to }]);
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

export interface Stay {
  checkIn: Date;
  checkOut: Date;
  // Every night of the stay: checkIn up to the night before checkOut.
  nights: Date[];
}

// HTL-15, HTL-11: the searched stay, with the same rules as a booking (HTL-18): check-out after
// check-in, and check-in not in the past (today is allowed).
export function parseStay(checkIn: string, checkOut: string): Stay {
  const stay = {
    checkIn: parseNight(checkIn, 'checkIn'),
    checkOut: parseNight(checkOut, 'checkOut'),
  };
  if (stay.checkOut <= stay.checkIn) {
    throw new BadRequestException('checkOut must be after checkIn.');
  }
  if (stay.checkIn < todayUtc()) {
    throw new BadRequestException('checkIn cannot be in the past.');
  }
  return { ...stay, nights: stayNights(stay.checkIn, stay.checkOut) };
}

function contains(range: NightRange, night: Date): boolean {
  return range.from <= night && night <= range.to;
}

// The room can be booked on every night: active, each night inside a bookable range and outside
// every blocked range. The same rule as Area 1's hold (hotel-bookings.service.ts,
// checkAvailability). Reserved nights are checked separately (RoomInventoryService).
export function isBookableFor(
  room: {
    active?: boolean;
    availableRanges?: NightRange[];
    blockedRanges?: NightRange[];
  },
  nights: Date[],
): boolean {
  return (
    room.active !== false &&
    nights.every(
      (night) =>
        (room.availableRanges ?? []).some((r) => contains(r, night)) &&
        !(room.blockedRanges ?? []).some((r) => contains(r, night)),
    )
  );
}
