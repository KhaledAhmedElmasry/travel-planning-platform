// P-21 flight booking details content (FLT-25, FLT-26, PAY-03, FLT-23, GEN-06).
// All details: segments in each airport's local time, passengers, baggage, total, status, payment
// status, refund status; the e-ticket for a Confirmed booking; cancel with the refund preview.
// Bonus for a Confirmed booking: change flight (FLT-27) and seat selection (FLT-28).
import { DownloadIcon } from "lucide-react";
import { Price } from "@/components/app/price";
import { plural } from "@/components/app/bookings/booking-list-item";
import {
  BookingStatusSection,
  CancelBooking,
  ContinuePayment,
  type BookingPayment,
  type BookingRefund,
} from "@/components/app/bookings/booking-status";
import { ChangeFlightPanel } from "@/components/app/bookings/change-flight-panel";
import { SeatMap, type SeatMapData } from "@/components/app/bookings/seat-map";
import { CABIN_LABEL_FALLBACK } from "@/components/app/checkout/cabin-labels";
import { localDateTime } from "@/components/app/checkout/confirmation-panel";
import type { CancellationPreview } from "@/components/app/checkout/refund-preview";
import { Button } from "@/components/ui/button";

/** GET /api/flight-bookings/{id} (backend toResponse() + payment, refund, cancellation): the fields shown. */
export type FlightBookingDetailsData = {
  id: string;
  reference: string | null;
  status: string;
  holdExpiresAt: string | null;
  segments: {
    flightId: string;
    flightNumber: string;
    airlineName: string;
    cabinClass: string;
    departureAirport: string;
    arrivalAirport: string;
    departureLocal: string;
    arrivalLocal: string;
    /** Cabin price per seat at booking time, cents. */
    fare: number;
    freeBags: number;
    maxBagWeightKg: number;
  }[];
  passengers: { type: string; fullName: string; extraBags: { weightKg: number }[]; fare: number; baggageFee: number }[];
  totalAmount: number;
  currency: string;
  payment: BookingPayment;
  refund: BookingRefund;
  cancellation: CancellationPreview;
  /** FLT-28 (bonus): the seats the passengers chose. */
  seatAssignments: { segment: "outbound" | "return"; passengerIndex: number; seatNumber: string }[];
};

const PASSENGER_TYPE: Record<string, string> = { adult: "Adult", child: "Child", infant: "Infant" };

export function FlightBookingDetails({
  booking,
  seatMap = null,
  now = new Date(),
}: {
  booking: FlightBookingDetailsData;
  /** GET /api/flight-bookings/{id}/seats (FLT-28); null when it could not be read. */
  seatMap?: SeatMapData | null;
  now?: Date;
}) {
  return (
    <div className="grid gap-6">
      {booking.reference && (
        <p>
          Booking reference: <strong className="font-mono text-lg">{booking.reference}</strong>
        </p>
      )}
      <BookingStatusSection status={booking.status} payment={booking.payment} refund={booking.refund} />

      <section aria-labelledby="flights-heading" className="grid gap-2">
        <h2 id="flights-heading" className="text-lg font-semibold">
          Flights
        </h2>
        <ul className="grid gap-2">
          {booking.segments.map((s) => (
            <li key={s.flightId} className="rounded-lg border border-border p-3">
              <p className="font-medium">
                {s.airlineName} · {s.flightNumber} · {CABIN_LABEL_FALLBACK[s.cabinClass] ?? s.cabinClass}
              </p>
              <p className="text-sm text-muted-foreground">
                {s.departureAirport} {localDateTime(s.departureLocal)} → {s.arrivalAirport} {localDateTime(s.arrivalLocal)}
              </p>
              <p className="text-sm text-muted-foreground">
                {plural(s.freeBags, "free bag")} up to {s.maxBagWeightKg} kg
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="passengers-heading" className="grid gap-2">
        <h2 id="passengers-heading" className="text-lg font-semibold">
          Passengers
        </h2>
        <ul className="grid gap-1">
          {booking.passengers.map((p, i) => (
            <li key={`${p.fullName}-${i}`}>
              {p.fullName} · {PASSENGER_TYPE[p.type] ?? p.type}
              {p.extraBags.length > 0 &&
                ` · ${plural(p.extraBags.length, "extra bag")} (${p.extraBags.map((b) => `${b.weightKg} kg`).join(", ")})`}
            </li>
          ))}
        </ul>
      </section>

      <p className="flex items-baseline gap-2">
        Total <Price cents={booking.totalAmount} currency={booking.currency} size="lg" />
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <ContinuePayment kind="flight" id={booking.id} status={booking.status} holdExpiresAt={booking.holdExpiresAt} now={now} />
        {booking.status === "confirmed" && (
          <Button asChild variant="secondary">
            <a href={`/api/flight-bookings/${booking.id}/e-ticket`} download>
              <DownloadIcon aria-hidden="true" />
              Download e-ticket (PDF)
            </a>
          </Button>
        )}
        <CancelBooking kind="flight" id={booking.id} status={booking.status} cancellation={booking.cancellation} />
      </div>

      {booking.status === "confirmed" && (
        <>
          {seatMap && (
            <section aria-labelledby="seats-heading" className="grid gap-2">
              <h2 id="seats-heading" className="text-lg font-semibold">
                Seats
              </h2>
              <SeatMap booking={booking} map={seatMap} />
            </section>
          )}
          <section aria-labelledby="change-heading" className="grid gap-2">
            <h2 id="change-heading" className="text-lg font-semibold">
              Change flight
            </h2>
            <ChangeFlightPanel booking={booking} />
          </section>
        </>
      )}
    </div>
  );
}
