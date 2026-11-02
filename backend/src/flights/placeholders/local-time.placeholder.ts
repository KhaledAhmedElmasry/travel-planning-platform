// TODO(AREA-5): PLACEHOLDER until Area 5 shared local-time helper is merged. Replace helper and delete this file.
// Requirement: FLT-12, GEN-06.
import { BadRequestException } from '@nestjs/common';
import { DateTime } from 'luxon';

export function getUtcRangeForLocalDate(
  localDate: string,
  timeZone: string,
): { startUtc: Date; endUtc: Date } {
  const start = DateTime.fromISO(localDate, { zone: timeZone }).startOf('day');
  if (!start.isValid) {
    throw new BadRequestException(
      `Could not interpret the search date in time zone ${timeZone}.`,
    );
  }
  // Add one local calendar day before converting to UTC, so DST days are handled correctly.
  const end = start.plus({ days: 1 });
  return {
    startUtc: start.toUTC().toJSDate(),
    endUtc: end.toUTC().toJSDate(),
  };
}

export function toLocalIsoString(date: Date, timeZone: string): string {
  const local = DateTime.fromJSDate(date, { zone: 'utc' }).setZone(timeZone);
  if (!local.isValid) {
    throw new BadRequestException(
      `Could not format the flight time in time zone ${timeZone}.`,
    );
  }
  const formatted = local.toISO();
  if (!formatted) {
    throw new BadRequestException(
      `Could not format the flight time in time zone ${timeZone}.`,
    );
  }
  return formatted;
}
