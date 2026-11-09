import { formatDate } from '../hotel-bookings/stay-dates';
import type { RoomDateRange } from './schemas/room.schema';

export type RoomCalendarStatus = 'available' | 'booked' | 'blocked';

export interface CalendarNight {
  date: string;
  status: RoomCalendarStatus;
  reference: string | null;
}

export interface CalendarRoom {
  active?: boolean;
  availableRanges?: RoomDateRange[];
  blockedRanges?: RoomDateRange[];
}

export interface TakenNight {
  night: Date;
  reference: string | null;
}

function contains(range: RoomDateRange, night: Date): boolean {
  return range.from <= night && night <= range.to;
}

export function buildRoomCalendar(
  room: CalendarRoom,
  nights: Date[],
  takenNights: TakenNight[],
): CalendarNight[] {
  const takenByDate = new Map(
    takenNights.map((taken) => [formatDate(taken.night), taken.reference]),
  );

  return nights.map((night) => {
    const date = formatDate(night);
    const takenReference = takenByDate.get(date);
    if (takenByDate.has(date)) {
      return { date, status: 'booked', reference: takenReference ?? null };
    }

    const bookable =
      room.active !== false &&
      (room.availableRanges ?? []).some((range) => contains(range, night)) &&
      !(room.blockedRanges ?? []).some((range) => contains(range, night));

    return {
      date,
      status: bookable ? 'available' : 'blocked',
      reference: null,
    };
  });
}
