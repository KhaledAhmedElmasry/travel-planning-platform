// BookingListItem
// Part: Lead (foundation)
// Requirements: FLT-25, HTL-20
// Used by: P-20, P-22, /home
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
//
// <BookingListItem kind="flight" booking={item} />   (item from GET /api/flight-bookings?group=)
// <BookingListItem kind="hotel" booking={item} />    (item from GET /api/hotel-bookings?group=)
// One row of My bookings; the whole row opens the details (FLT-25, HTL-20).
// Flights: reference, flight, date, passengers, cabin, status. Hotels: reference, hotel, rooms,
// dates, guests, total, status. Flight times are the departure airport's local time (GEN-06).
// TODO(ask team leader): a Pending Payment booking never appears in any group of the list
// (backend: upcoming = Confirmed only) and list items carry no holdExpiresAt, so the
// "Continue payment" button is on the details pages only. Should the backend list them?
import Link from "next/link";
import { Price } from "@/components/app/price";
import { StatusBadge } from "@/components/app/status-badge";
import { CABIN_LABEL_FALLBACK } from "@/components/app/checkout/cabin-labels";
import { localDateTime } from "@/components/app/checkout/confirmation-panel";
import { formatDay } from "@/lib/dates";

/** Backend flight-bookings.service.ts toListItem() */
export type FlightBookingListItem = {
  id: string;
  reference: string | null;
  status: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureAt: string;
  departureLocal: string;
  passengers: number;
  cabinClass: string;
};

/** Backend hotel-bookings.service.ts toListItem() */
export type HotelBookingListItem = {
  id: string;
  reference: string | null;
  status: string;
  hotel: { id: string; name: string };
  rooms: { roomId: string; roomNumber: string; type: string }[];
  checkIn: string;
  checkOut: string;
  guests: { adults: number; children: number };
  totalAmount: number;
  currency: string;
};

type Props =
  | { kind: "flight"; booking: FlightBookingListItem }
  | { kind: "hotel"; booking: HotelBookingListItem };

export function plural(count: number, word: string, many = `${word}s`): string {
  return `${count} ${count === 1 ? word : many}`;
}

export function BookingListItem(props: Props) {
  const { booking } = props;
  const href = props.kind === "flight" ? `/bookings/flights/${booking.id}` : `/bookings/hotels/${booking.id}`;
  return (
    <Link
      href={href}
      className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-input"
    >
      <div className="grid min-w-0 gap-1">
        {booking.reference && <span className="font-mono text-sm text-muted-foreground">{booking.reference}</span>}
        {props.kind === "flight" ? (
          <>
            <span className="font-semibold">
              {props.booking.flightNumber} · {props.booking.departureAirport} → {props.booking.arrivalAirport}
            </span>
            <span className="text-sm text-muted-foreground">
              {localDateTime(props.booking.departureLocal)} · {plural(props.booking.passengers, "passenger")} ·{" "}
              {CABIN_LABEL_FALLBACK[props.booking.cabinClass] ?? props.booking.cabinClass}
            </span>
          </>
        ) : (
          <>
            <span className="font-semibold">{props.booking.hotel.name}</span>
            <span className="text-sm text-muted-foreground">
              {formatDay(props.booking.checkIn)} – {formatDay(props.booking.checkOut)} ·{" "}
              {plural(props.booking.guests.adults, "adult")}
              {props.booking.guests.children > 0 && `, ${plural(props.booking.guests.children, "child", "children")}`}
            </span>
            <ul className="text-sm">
              {props.booking.rooms.map((r) => (
                <li key={r.roomId}>
                  Room {r.roomNumber} · {r.type}
                </li>
              ))}
            </ul>
            <Price cents={props.booking.totalAmount} currency={props.booking.currency} size="sm" />
          </>
        )}
      </div>
      <StatusBadge kind="booking" status={booking.status as "confirmed"} />
    </Link>
  );
}
