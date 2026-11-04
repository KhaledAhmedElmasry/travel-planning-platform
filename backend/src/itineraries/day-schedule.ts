export interface ScheduledDay {
  _id?: string | { toString(): string };
  number: number;
  date: Date;
  cityId: string;
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

export function dayDate(startDate: Date, number: number): Date {
  const date = new Date(startDate);
  date.setUTCDate(date.getUTCDate() + number - 1);
  return date;
}

export function renumberDays<T extends ScheduledDay>(
  days: T[],
  startDate: Date,
): T[] {
  days.forEach((day, index) => {
    day.number = index + 1;
    day.date = dayDate(startDate, day.number);
  });
  return days;
}

export function computeCityGroups(days: ScheduledDay[]): CityGroupDay[] {
  const groups: CityGroupDay[] = [];

  for (const day of days) {
    const previous = groups[groups.length - 1];
    if (previous?.cityId === day.cityId) {
      previous.lastDay = day.number;
      previous.dayCount += 1;
      previous.dayNumbers.push(day.number);
      if (day._id !== undefined) previous.dayIds.push(toIdString(day._id));
      previous.endDate = toDateString(day.date);
      continue;
    }

    groups.push({
      cityId: day.cityId,
      firstDay: day.number,
      lastDay: day.number,
      dayCount: 1,
      dayNumbers: [day.number],
      dayIds: day._id === undefined ? [] : [toIdString(day._id)],
      startDate: toDateString(day.date),
      endDate: toDateString(day.date),
    });
  }

  return groups;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toIdString(id: string | { toString(): string }): string {
  return typeof id === 'string' ? id : id.toString();
}
