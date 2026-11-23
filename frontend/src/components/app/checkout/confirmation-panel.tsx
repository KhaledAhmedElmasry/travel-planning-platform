// ConfirmationPanel
// Part: Lead (foundation)
// Requirements: FLT-23, HTL-17
// Used by: P-17
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
//
// <ConfirmationPanel kind="flight" booking={await backendJson(`/api/flight-bookings/${id}`)} />
// P-17 (FLT-23, HTL-17): the unique booking reference, the booking details, for flights the
// e-ticket PDF (GET /api/flight-bookings/{id}/e-ticket, same origin so the session cookie goes
// along), and links to My bookings and the booking details. Flight times are the stored local
// times of each airport (GEN-06).
import Link from "next/link";
import { CircleCheckIcon, DownloadIcon } from "lucide-react";
import { Price } from "@/components/app/price";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/dates";
import { CABIN_LABEL_FALLBACK } from "./cabin-labels";

export type ConfirmedFlightBooking = {
  id: string;
  reference: string | null;
  status: string;
  segments: {
    flightId: string;
    flightNumber: string;
    airlineName: string;
    cabinClass: string;
    departureAirport: string;
    arrivalAirport: string;
    departureLocal: string;
    arrivalLocal: string;
  }[];
  passengers: { type: string; fullName: string }[];
  totalAmount: number;
  currency: string;
};

export type ConfirmedHotelBooking = {
  id: string;
  reference: string | null;
  status: string;
  hotel: { id: string; name: string };
  checkIn: string;
  checkOut: string;
  nights: number;
  rooms: { roomId: string; roomNumber: string; type: string }[];
  totalAmount: number;
  currency: string;
};

type Props =
  | { kind: "flight"; booking: ConfirmedFlightBooking }
  | { kind: "hotel"; booking: ConfirmedHotelBooking };

/** "2027-03-01T08:00" -> "<day> 08:00" (already the airport's local time). */
function localDateTime(value: string): string {
  return `${formatDay(value.slice(0, 10))} ${value.slice(11, 16)}`;
}

export function ConfirmationPanel(props: Props) {
  const { booking } = props;
  const detailsHref = props.kind === "flight" ? `/bookings/flights/${booking.id}` : `/bookings/hotels/${booking.id}`;
  return (
    <section aria-labelledby="confirmed-title" className="grid gap-6 rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="grid gap-1">
        <h2 id="confirmed-title" className="flex items-center gap-2 text-xl font-semibold">
          <CircleCheckIcon className="size-6 text-success" aria-hidden="true" />
          Booking confirmed
        </h2>
        <p>
          Booking reference: <strong className="font-mono text-lg">{booking.reference}</strong>
        </p>
      </div>

      {props.kind === "flight" ? (
        <div className="grid gap-4">
          <ul className="grid gap-2">
            {props.booking.segments.map((s) => (
              <li key={s.flightId} className="rounded-lg border border-border p-3">
                <p className="font-medium">
                  {s.airlineName} · {s.flightNumber} · {CABIN_LABEL_FALLBACK[s.cabinClass] ?? s.cabinClass}
                </p>
                <p className="text-sm text-muted-foreground">
                  {s.departureAirport} {localDateTime(s.departureLocal)} → {s.arrivalAirport} {localDateTime(s.arrivalLocal)}
                </p>
              </li>
            ))}
          </ul>
          <div>
            <h3 className="font-medium">Passengers</h3>
            <ul className="text-sm">
              {props.booking.passengers.map((p, i) => (
                <li key={`${p.fullName}-${i}`}>{p.fullName}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="grid gap-1">
          <p className="font-medium">{props.booking.hotel.name}</p>
          <p className="text-sm text-muted-foreground">
            {formatDay(props.booking.checkIn)} – {formatDay(props.booking.checkOut)} · {props.booking.nights} night
            {props.booking.nights === 1 ? "" : "s"}
          </p>
          <ul className="text-sm">
            {props.booking.rooms.map((r) => (
              <li key={r.roomId}>
                Room {r.roomNumber} · {r.type}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="flex items-baseline gap-2">
        Total paid <Price cents={booking.totalAmount} currency={booking.currency} size="lg" />
      </p>

      <div className="flex flex-wrap gap-2">
        {props.kind === "flight" && (
          <Button asChild>
            <a href={`/api/flight-bookings/${booking.id}/e-ticket`} download>
              <DownloadIcon aria-hidden="true" />
              Download e-ticket (PDF)
            </a>
          </Button>
        )}
        <Button asChild variant="secondary">
          <Link href={detailsHref}>Booking details</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/bookings">My bookings</Link>
        </Button>
      </div>
    </section>
  );
}
