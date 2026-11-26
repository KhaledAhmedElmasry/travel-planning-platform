// HotelBookingSummary
// Part: T2 Hotels + my posts list
// Requirements: HTL-16, HTL-09
// Used by: P-19
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError, apiFetch } from "@/lib/api";
import { Price } from "@/components/app/price";
import { HoldCountdown } from "@/components/app/hold-countdown";
import { PolicyAcceptance, type BookingPolicies } from "@/components/app/checkout/policy-acceptance";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { GuestsPerRoom, type RoomGuests } from "./guests-per-room";

export type AvailableRoom = { id: string; roomNumber: string; type: string; beds: number; maxOccupancy: number; pricePerNight: number; nights: number; totalPrice: number; currency: string; checkIn: string; checkOut: string };
export type BookingHotel = { id: string; name: string; checkInTime: string; checkOutTime: string; availableRooms?: AvailableRoom[] };
type Booking = { id: string; holdExpiresAt: string; totalAmount: number; currency: string };

type Props = { hotel: BookingHotel; requestedRooms: number; requestedGuests: number; checkIn: string; checkOut: string };

export function HotelBookingSummary({ hotel, requestedRooms, requestedGuests, checkIn, checkOut }: Props) {
  const router = useRouter();
  const rooms = hotel.availableRooms ?? [];
  const [selected, setSelected] = useState<string[]>([]);
  const [guests, setGuests] = useState<Record<string, RoomGuests>>({});
  const [booking, setBooking] = useState<Booking | null>(null);
  const [policies, setPolicies] = useState<BookingPolicies | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRooms = rooms.filter((room) => selected.includes(room.id));
  const total = useMemo(() => selectedRooms.reduce((sum, room) => sum + room.totalPrice, 0), [selectedRooms]);
  const adultCount = selectedRooms.reduce((sum, room) => sum + (guests[room.id]?.adults ?? 0), 0);
  const guestCount = selectedRooms.reduce((sum, room) => sum + (guests[room.id]?.adults ?? 0) + (guests[room.id]?.childrenAges.length ?? 0), 0);

  if (rooms.length === 0) return <EmptyState title="No rooms available" line="Those rooms are already booked." description="Go back and try different dates." />;

  function toggleRoom(room: AvailableRoom) {
    setError(null);
    setSelected((current) => {
      if (current.includes(room.id)) return current.filter((id) => id !== room.id);
      if (current.length >= requestedRooms) return current;
      setGuests((values) => ({ ...values, [room.id]: values[room.id] ?? { adults: 1, childrenAges: [] } }));
      return [...current, room.id];
    });
  }

  async function createHold() {
    if (selectedRooms.length !== requestedRooms) return setError(`Select ${requestedRooms} room${requestedRooms === 1 ? "" : "s"}.`);
    if (adultCount < 1) return setError("At least one adult is required.");
    if (guestCount !== requestedGuests) return setError(`Assign exactly ${requestedGuests} guest${requestedGuests === 1 ? "" : "s"}.`);
    if (selectedRooms.some((room) => (guests[room.id]?.adults ?? 0) + (guests[room.id]?.childrenAges.length ?? 0) > room.maxOccupancy)) return setError("A room has more guests than its maximum occupancy.");
    setBusy(true);
    setError(null);
    try {
      const created = await apiFetch<Booking>("/api/hotel-bookings", { method: "POST", json: { hotelId: hotel.id, checkIn, checkOut, rooms: selectedRooms.map((room) => ({ roomId: room.id, adults: guests[room.id].adults, childrenAges: guests[room.id].childrenAges })) } });
      const data = await apiFetch<BookingPolicies>(`/api/bookings/hotel/${created.id}/policies`);
      setBooking(created);
      setPolicies(data);
      toast.success("Rooms held for 10 minutes");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "We couldn't hold these rooms. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (booking && policies) {
    return (
      <div className="grid gap-6">
        <HoldCountdown bookingType="hotel" expiresAt={booking.holdExpiresAt} onExpire={() => setError("The room hold has expired. Please search again.")} />
        <div className="grid gap-2">
          <h2 className="text-lg font-semibold">Booking summary</h2>
          <p>{selectedRooms.length} room{selectedRooms.length === 1 ? "" : "s"} · {checkIn} to {checkOut}</p>
          <Price cents={booking.totalAmount} currency={booking.currency} size="lg" />
          <p className="text-sm text-muted-foreground">Check-in from {hotel.checkInTime}; check-out by {hotel.checkOutTime}.</p>
        </div>
        <PolicyAcceptance data={policies} onAccepted={() => router.push(`/checkout/hotel/${booking.id}`)} />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h2 className="text-lg font-semibold">Choose your rooms</h2>
        <p className="text-muted-foreground">Select {requestedRooms} room{requestedRooms === 1 ? "" : "s"} for {requestedGuests} guest{requestedGuests === 1 ? "" : "s"}.</p>
      </div>
      <div className="grid gap-3">
        {rooms.map((room) => {
          const isSelected = selected.includes(room.id);
          return (
            <button key={room.id} type="button" aria-pressed={isSelected} onClick={() => toggleRoom(room)} className={`grid gap-2 rounded-lg border p-4 text-left ${isSelected ? "border-primary bg-muted" : "border-border bg-card"}`}>
              <span className="font-semibold">Room {room.roomNumber} · {room.type}</span>
              <span className="text-sm text-muted-foreground">{room.beds} bed{room.beds === 1 ? "" : "s"} · up to {room.maxOccupancy} guests</span>
              <Price cents={room.totalPrice} currency={room.currency} />
            </button>
          );
        })}
      </div>
      {selectedRooms.map((room) => <GuestsPerRoom key={room.id} roomNumber={room.roomNumber} maxOccupancy={room.maxOccupancy} value={guests[room.id] ?? { adults: 1, childrenAges: [] }} onChange={(value) => setGuests((current) => ({ ...current, [room.id]: value }))} />)}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
        <div><span className="text-sm text-muted-foreground">Estimated total</span><Price cents={total} currency={selectedRooms[0]?.currency ?? ""} size="lg" /></div>
        <Button onClick={createHold} loading={busy} disabled={selectedRooms.length !== requestedRooms}>Proceed to payment</Button>
      </div>
    </div>
  );
}
