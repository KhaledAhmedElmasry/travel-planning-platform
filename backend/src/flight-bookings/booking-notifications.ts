import { formatMoney } from '../payments/format-money';
import {
  NotificationText,
  refundSentence,
} from '../payments/notification-text';
import type { RefundResponse } from '../payments/refunds.service';
import { localTime } from './e-ticket';
import type { FlightBooking } from './schemas/flight-booking.schema';

// Area: Payments, Holds & Booking Engine
// GEN-01: texts of the in-app notifications about a flight booking. Times are local to each
// airport (GEN-06), amounts in the platform currency (PAY-04).

// "MS777 CAI → DXB, departs 2027-03-01 10:00 (Africa/Cairo)" for every segment.
function flightsLine(booking: FlightBooking): string {
  return booking.segments
    .map(
      (s) =>
        `${s.flightNumber} ${s.departureAirport.code} → ${s.arrivalAirport.code}, departs ${localTime(s.departureAt, s.departureAirport.timeZone)}`,
    )
    .join('; ');
}

// FLT-23: confirmation with the booking details.
export function flightConfirmedText(booking: FlightBooking): NotificationText {
  const passengers = booking.passengers.length;
  return {
    title: 'Flight booking confirmed',
    message: `Booking ${booking.reference} is confirmed. ${flightsLine(booking)}. ${passengers} passenger${passengers === 1 ? '' : 's'}. Total paid: ${formatMoney(booking.totalAmount, booking.currency)}. Your e-ticket can be downloaded from the booking.`,
  };
}

// FLT-26: the user cancelled.
export function flightCancelledText(
  booking: FlightBooking,
  refund: RefundResponse | null,
): NotificationText {
  return {
    title: 'Flight booking cancelled',
    message: `Booking ${booking.reference} (${flightsLine(booking)}) is cancelled. ${refundSentence(refund)}`,
  };
}

// FLT-06: the airline cancelled a flight of a Confirmed booking (refund 100%).
export function flightCancelledByAirlineText(
  booking: FlightBooking,
): NotificationText {
  return {
    title: 'Flight cancelled by the airline',
    message: `The airline cancelled a flight of booking ${booking.reference} (${flightsLine(booking)}). The booking is cancelled and the full amount of ${formatMoney(booking.totalAmount, booking.currency)} is being refunded.`,
  };
}

// FLT-06: the airline cancelled a flight while the booking was still on hold (not paid).
export function flightHoldEndedByAirlineText(
  booking: FlightBooking,
): NotificationText {
  return {
    title: 'Flight cancelled by the airline',
    message: `The airline cancelled a flight you were booking (${flightsLine(booking)}), so your seat hold has ended. You have not been charged.`,
  };
}
