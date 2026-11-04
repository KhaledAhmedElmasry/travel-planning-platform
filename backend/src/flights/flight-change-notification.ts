import { utcToLocal } from './flight-time';

// Area: Airlines & Flight Inventory
// GEN-01, NEW-02: the in-app notification sent to passengers with a Confirmed booking when the
// airline changes the times of a flight (FLT-05). Times are local to each airport (GEN-06).

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
  bookingReference: string | undefined,
  before: FlightTimes,
  after: FlightTimes,
): { title: string; message: string } {
  const booking = bookingReference ? ` of booking ${bookingReference}` : '';
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
