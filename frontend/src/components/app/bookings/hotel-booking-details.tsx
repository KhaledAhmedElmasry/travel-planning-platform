// P-23 hotel reservation details content (HTL-20, HTL-21, PAY-03).
// All details, payment status and refund status; cancel the whole reservation (no partial
// cancellation) before the check-in date with the refund preview on the full total.
import { Price } from "@/components/app/price";
import { plural } from "@/components/app/bookings/booking-list-item";
import {
  BookingStatusSection,
  CancelBooking,
  ContinuePayment,
  type BookingPayment,
  type BookingRefund,
} from "@/components/app/bookings/booking-status";
import type { CancellationPreview } from "@/components/app/checkout/refund-preview";
import { formatDay } from "@/lib/dates";

/** GET /api/hotel-bookings/{id} (backend toResponse() + hotel times, payment, refund, cancellation): the fields shown. */
export type HotelBookingDetailsData = {
  id: string;
  reference: string | null;
  status: string;
  holdExpiresAt: string | null;
  hotel: { id: string; name: string; checkInTime: string | null; checkOutTime: string | null };
  checkIn: string;
  checkOut: string;
  nights: number;
  rooms: {
    roomId: string;
    roomNumber: string;
    type: string;
    beds: number;
    adults: number;
    childrenAges: number[];
    pricePerNight: number;
    subtotal: number;
  }[];
  guests: { adults: number; children: number };
  totalAmount: number;
  currency: string;
  payment: BookingPayment;
  refund: BookingRefund;
  cancellation: CancellationPreview;
};

export function HotelBookingDetails({ booking, now = new Date() }: { booking: HotelBookingDetailsData; now?: Date }) {
  const { hotel } = booking;
  return (
    <div className="grid gap-6">
      {booking.reference && (
        <p>
          Booking reference: <strong className="font-mono text-lg">{booking.reference}</strong>
        </p>
      )}
      <BookingStatusSection status={booking.status} payment={booking.payment} refund={booking.refund} />

      <section aria-labelledby="stay-heading" className="grid gap-1">
        <h2 id="stay-heading" className="text-lg font-semibold">
          {hotel.name}
        </h2>
        <p className="text-sm text-muted-foreground">
          {formatDay(booking.checkIn)} – {formatDay(booking.checkOut)} · {plural(booking.nights, "night")}
        </p>
        {/* TODO(ask team leader): wording "Check-in from 14:00 · Check-out by 12:00" is mine. */}
        {hotel.checkInTime && hotel.checkOutTime && (
          <p className="text-sm text-muted-foreground">
            Check-in from {hotel.checkInTime} · Check-out by {hotel.checkOutTime}
          </p>
        )}
      </section>

      <section aria-labelledby="rooms-heading" className="grid gap-2">
        <h2 id="rooms-heading" className="text-lg font-semibold">
          Rooms
        </h2>
        <ul className="grid gap-2">
          {booking.rooms.map((r) => (
            <li key={r.roomId} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border p-3">
              <span>
                Room {r.roomNumber} · {r.type} · {plural(r.beds, "bed")} · {plural(r.adults, "adult")}
                {r.childrenAges.length > 0 &&
                  `, ${plural(r.childrenAges.length, "child", "children")} (${r.childrenAges.join(", ")})`}
              </span>
              <span className="flex items-baseline gap-2 text-sm">
                <Price cents={r.pricePerNight} currency={booking.currency} size="sm" hideCode /> per night ·
                <Price cents={r.subtotal} currency={booking.currency} size="sm" />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="flex items-baseline gap-2">
        Total <Price cents={booking.totalAmount} currency={booking.currency} size="lg" />
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <ContinuePayment kind="hotel" id={booking.id} status={booking.status} holdExpiresAt={booking.holdExpiresAt} now={now} />
        <CancelBooking kind="hotel" id={booking.id} status={booking.status} cancellation={booking.cancellation} />
      </div>

      {/* TODO(L2): review section (HTL-23) after ReviewCard/StarRating merge */}
    </div>
  );
}
