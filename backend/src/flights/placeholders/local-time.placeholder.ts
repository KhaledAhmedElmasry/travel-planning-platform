// TODO(AREA-5): PLACEHOLDER until Area 5's local-time helper is merged. Replace these helpers with the shared helper and delete this file.
// Requirements: FLT-11, GEN-06.
import { InternalServerErrorException } from '@nestjs/common';
import { DateTime } from 'luxon';

export interface UtcDateRange {
  startUtc: Date;
  endUtc: Date;
}

export function getUtcRangeForLocalDate(
  localDate: string,
  timeZone: string,
): UtcDateRange {
  // Calculate consecutive local midnights so DST days correctly span 23 or 25 hours.
  const startOfDay = DateTime.fromISO(localDate, { zone: timeZone }).startOf(
    'day',
  );
  const startOfNextDay = startOfDay.plus({ days: 1 }).startOf('day');
  if (!startOfDay.isValid || !startOfNextDay.isValid) {
    throw new InternalServerErrorException(
      'The departure airport has an invalid time zone configuration.',
    );
  }
  return {
    startUtc: startOfDay.toUTC().toJSDate(),
    endUtc: startOfNextDay.toUTC().toJSDate(),
  };
}

export function toLocalIsoString(utcDate: Date, timeZone: string): string {
  const localDateTime = DateTime.fromJSDate(utcDate, { zone: timeZone });
  if (!localDateTime.isValid) {
    throw new InternalServerErrorException(
      'An airport has an invalid time zone configuration.',
    );
  }
  return localDateTime.toISO();
}
