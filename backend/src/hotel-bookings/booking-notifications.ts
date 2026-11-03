import { formatMoney } from '../payments/format-money';
import {
  NotificationText,
  refundSentence,
} from '../payments/notification-text';
import type { RefundResponse } from '../payments/refunds.service';
import type { HotelBooking } from './schemas/hotel-booking.schema';
import { formatDate } from './stay-dates';

// Area: Payments, Holds & Booking Engine
// GEN-01: texts of the in-app notifications about a hotel reservation. Dates are calendar dates
// (stored at 00:00 UTC, HTL-18), amounts in the platform currency (PAY-04).

// "Nile View Hotel, 2027-04-10 to 2027-04-12 (2 nights), 1 room"
function stayLine(booking: HotelBooking): string {
  const rooms = booking.rooms.length;
  return `${booking.hotelName}, ${formatDate(booking.checkIn)} to ${formatDate(booking.checkOut)} (${booking.nights} night${booking.nights === 1 ? '' : 's'}), ${rooms} room${rooms === 1 ? '' : 's'}`;
}

// HTL-17: confirmation with the reservation details.
export function hotelConfirmedText(booking: HotelBooking): NotificationText {
  return {
    title: 'Hotel reservation confirmed',
    message: `Reservation ${booking.reference} is confirmed: ${stayLine(booking)}. Total paid: ${formatMoney(booking.totalAmount, booking.currency)}.`,
  };
}

// HTL-21: the user cancelled.
export function hotelCancelledText(
  booking: HotelBooking,
  refund: RefundResponse | null,
): NotificationText {
  return {
    title: 'Hotel reservation cancelled',
    message: `Reservation ${booking.reference} (${stayLine(booking)}) is cancelled. ${refundSentence(refund)}`,
  };
}
