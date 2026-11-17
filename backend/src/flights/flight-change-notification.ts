import { utcToLocal } from './flight-time';

// Area: Airlines & Flight Inventory
// GEN-01, FLT-05: the in-app notification sent to passengers with a Confirmed booking when the
// airline changes the times of a flight (FLT-05). Times are local to each airport (GEN-06).
// FLT-05: each affected user gets exactly ONE notification per change, listing all of their
// bookings on the flight.

export interface FlightTimes {
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTimeZone: string;
  arrivalTimeZone: string;
  departureAt: Date;
  arrivalAt: Date;
}

function local(date: Date, timeZone: string): string {
  return `${utcToLocal(date, timeZone).replace('T', ' ')} (${timeZone})`;
}

export function flightTimeChangedText(
  bookingReferences: readonly (string | undefined)[],
  before: FlightTimes,
  after: FlightTimes,
): { title: string; message: string } {
  const refs = bookingReferences.filter((r): r is string => !!r);
  const booking =
    refs.length === 0
      ? ''
      : refs.length === 1
        ? ` of booking ${refs[0]}`
        : ` of your bookings ${refs.join(', ')}`;
  return {
    title: 'Flight time changed',
    message:
      `The airline changed the times of flight ${after.flightNumber} ` +
      `${after.departureAirport} → ${after.arrivalAirport}${booking}. ` +
      `New times: departs ${local(after.departureAt, after.departureTimeZone)}, ` +
      `arrives ${local(after.arrivalAt, after.arrivalTimeZone)}. ` +
      `Previously: departs ${local(before.departureAt, before.departureTimeZone)}, ` +
      `arrives ${local(before.arrivalAt, before.arrivalTimeZone)}.`,
  };
}
