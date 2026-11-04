import { BadRequestException } from '@nestjs/common';
import { DateTime } from 'luxon';

// Area: Airlines & Flight Inventory
// GEN-06: flight times are entered in each airport's local time, stored in UTC and shown in the
// airport's local time zone. Uses luxon with the airport's IANA time zone (FLT-02).
// Also for Area 6 (flight search FLT-11 and flight details FLT-17).

const LOCAL_FORMAT = "yyyy-MM-dd'T'HH:mm";

// "2027-03-01T14:30" at Africa/Cairo -> the UTC Date. Throws 400 for a time that does not exist
// in that zone (the hour skipped when daylight saving time starts).
export function localToUtc(
  local: string,
  timeZone: string,
  field: string,
): Date {
  const time = DateTime.fromFormat(local, LOCAL_FORMAT, { zone: timeZone });
  if (!time.isValid || time.toFormat(LOCAL_FORMAT) !== local) {
    throw new BadRequestException(
      `${field} "${local}" is not a valid local time in ${timeZone}.`,
    );
  }
  return time.toUTC().toJSDate();
}

// The UTC Date -> "2027-03-01T14:30" in the airport's time zone.
export function utcToLocal(date: Date, timeZone: string): string {
  return DateTime.fromJSDate(date, { zone: timeZone }).toFormat(LOCAL_FORMAT);
}

// The UTC Date -> the local date "2027-03-01" in the airport's time zone.
export function utcToLocalDate(date: Date, timeZone: string): string {
  return DateTime.fromJSDate(date, { zone: timeZone }).toFormat('yyyy-MM-dd');
}
