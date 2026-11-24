"use client";

// SeatMap
// Part: Lead (foundation)
// Requirements: FLT-28 (Bonus)
// Used by: P-21
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
//
// <SeatMap booking={details} map={seatMap} />   (a Confirmed booking; map from GET /api/flight-bookings/{id}/seats)
// FLT-28: a seat map per flight (team leader decision 24 Nov): every seat of the cabin is available,
// taken (another booking) or this booking's own (selected). Pick a passenger, then a free seat:
// PATCH /api/flight-bookings/{id}/seat {passengerIndex, segment, seatNumber}. One seat per passenger:
// a new seat replaces the old one (backend). Infants take no seat (FLT-12). The page re-renders after a save.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api";

type Segment = "outbound" | "return";

/** The booking fields the seat map needs (GET /api/flight-bookings/{id}). */
export type SeatBooking = { id: string; passengers: { type: string; fullName: string }[] };

/** GET /api/flight-bookings/{id}/seats (openapi SeatMap). */
export type SeatMapData = {
  bookingId: string;
  segments: {
    segment: Segment;
    flightNumber: string;
    cabinClass: string;
    rows: number;
    letters: string;
    seats: { seatNumber: string; status: "available" | "taken" | "mine"; passengerIndex: number | null }[];
  }[];
};

export function SeatMap({ booking, map }: { booking: SeatBooking; map: SeatMapData }) {
  return (
    <div className="grid gap-6">
      {map.segments.map((s) => (
        <FlightSeats key={s.segment} booking={booking} flight={s} />
      ))}
    </div>
  );
}

function FlightSeats({ booking, flight }: { booking: SeatBooking; flight: SeatMapData["segments"][number] }) {
  const router = useRouter();
  const seated = booking.passengers.flatMap((p, index) => (p.type === "infant" ? [] : [{ index, name: p.fullName }]));
  const [active, setActive] = useState(seated[0]?.index ?? 0);
  const [busy, setBusy] = useState(false);
  const seatOf = (index: number) => flight.seats.find((s) => s.status === "mine" && s.passengerIndex === index)?.seatNumber;
  const nameOf = (index: number | null) => booking.passengers[index ?? -1]?.fullName ?? "";

  async function choose(seatNumber: string) {
    const name = nameOf(active);
    setBusy(true);
    try {
      await apiFetch(`/api/flight-bookings/${booking.id}/seat`, {
        method: "PATCH",
        json: { passengerIndex: active, segment: flight.segment, seatNumber },
      });
      toast.success(`Seat ${seatNumber} saved for ${name}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label={`Seats on ${flight.flightNumber}`} className="grid gap-3">
      <h3 className="font-medium">{flight.flightNumber}</h3>
      <div className="flex flex-wrap gap-2">
        {seated.map((p) => {
          const seat = seatOf(p.index);
          return (
            <Button
              key={p.index}
              size="sm"
              variant={p.index === active ? "default" : "outline"}
              aria-pressed={p.index === active}
              aria-label={`Choose a seat for ${p.name} (${seat ? `seat ${seat}` : "no seat yet"})`}
              onClick={() => setActive(p.index)}
            >
              {p.name} · {seat ?? "no seat"}
            </Button>
          );
        })}
      </div>
      <div className={`grid w-fit gap-2 ${flight.letters.length === 4 ? "grid-cols-4" : "grid-cols-6"}`}>
        {flight.seats.map((s) => {
          const selected = s.status === "mine" && s.passengerIndex === active;
          return (
            <Button
              key={s.seatNumber}
              size="sm"
              variant={selected ? "default" : s.status === "mine" ? "secondary" : s.status === "taken" ? "ghost" : "outline"}
              disabled={s.status !== "available" || busy}
              aria-pressed={selected}
              aria-label={`Seat ${s.seatNumber}, ${s.status === "mine" ? nameOf(s.passengerIndex) : s.status}`}
              onClick={() => choose(s.seatNumber)}
            >
              {s.seatNumber}
            </Button>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">Filled: your passengers&apos; seats. Faded: taken.</p>
    </section>
  );
}
