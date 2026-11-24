"use client";

// SeatMap
// Part: Lead (foundation)
// Requirements: FLT-28 (Bonus)
// Used by: P-21
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
//
// <SeatMap booking={details} />   (a Confirmed booking, see P-21)
// FLT-28: choose a seat per passenger on each flight (PATCH /api/flight-bookings/{id}/seat with
// passengerIndex, segment, seatNumber). Infants take no seat (FLT-12). The backend checks that the
// seat exists in the cabin and is free (409 "The seat is already taken.").
// TODO(ask team leader): the spec asks for a seat map (available / taken / selected), but no
// endpoint returns a flight's taken seats or the cabin's seat count, so for now each passenger
// types a seat number (e.g. 12A). A map needs a new backend route (e.g. GET .../seats).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiFetch } from "@/lib/api";

type Segment = "outbound" | "return";

/** The booking fields seat selection needs (GET /api/flight-bookings/{id}). */
export type SeatBooking = {
  id: string;
  segments: { flightId: string; flightNumber: string }[];
  passengers: { type: string; fullName: string }[];
  seatAssignments: { segment: Segment; passengerIndex: number; seatNumber: string }[];
};

export function SeatMap({ booking }: { booking: SeatBooking }) {
  return (
    <div className="grid gap-4">
      {booking.segments.map((s, i) => {
        const segment: Segment = i === 0 ? "outbound" : "return";
        return (
          <section key={s.flightId} aria-label={`Seats on ${s.flightNumber}`} className="grid gap-2">
            <h3 className="font-medium">{s.flightNumber}</h3>
            {booking.passengers.map((p, index) =>
              p.type === "infant" ? null : (
                <SeatRow
                  key={index}
                  bookingId={booking.id}
                  segment={segment}
                  passengerIndex={index}
                  name={p.fullName}
                  current={
                    booking.seatAssignments.find((a) => a.segment === segment && a.passengerIndex === index)?.seatNumber ?? ""
                  }
                />
              ),
            )}
          </section>
        );
      })}
    </div>
  );
}

function SeatRow(props: { bookingId: string; segment: Segment; passengerIndex: number; name: string; current: string }) {
  const router = useRouter();
  const [seat, setSeat] = useState(props.current);
  const [busy, setBusy] = useState(false);
  const id = `seat-${props.segment}-${props.passengerIndex}`;

  async function save() {
    const seatNumber = seat.trim().toUpperCase();
    setBusy(true);
    try {
      await apiFetch(`/api/flight-bookings/${props.bookingId}/seat`, {
        method: "PATCH",
        json: { passengerIndex: props.passengerIndex, segment: props.segment, seatNumber },
      });
      toast.success(`Seat ${seatNumber} saved for ${props.name}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor={id} className="min-w-40">
        {props.name}
      </Label>
      <Input id={id} value={seat} onChange={(e) => setSeat(e.target.value)} placeholder="12A" className="w-24" />
      <Button
        variant="secondary"
        size="sm"
        loading={busy}
        disabled={!seat.trim()}
        onClick={save}
        aria-label={`Save seat for ${props.name}`}
      >
        Save seat
      </Button>
    </div>
  );
}
