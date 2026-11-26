// HotelBookingSummary
// Part: T2 Hotels + my posts list
// Requirements: HTL-16, HTL-18, HTL-09, PAY-02
// Used by: P-19
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
// The P-19 wizard for the rooms chosen on P-18 (HTL-15): Step 1 Guests per room → Step 2 Summary (nothing
// held yet) → "Proceed to payment" creates the hold (POST /api/hotel-bookings, HTL-18) → Step 3 Policies
// → P-16 payment. After the hold the booking id goes into the URL, so a refresh resumes on P-16 instead of
// holding again.
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError, apiFetch } from "@/lib/api";
import { Price } from "@/components/app/price";
import { HoldCountdown } from "@/components/app/hold-countdown";
import { PolicyAcceptance, type BookingPolicies } from "@/components/app/checkout/policy-acceptance";
import { Button } from "@/components/ui/button";
import { WizardLayout } from "@/components/layout/wizard-layout";
import { GuestsPerRoom, type RoomGuests } from "./guests-per-room";

/** One room of GET /api/hotels/{id}?checkIn&checkOut `availableRooms` (openapi). */
export type AvailableRoom = { id: string; roomNumber: string; type: string; beds: number; maxOccupancy: number; pricePerNight: number; nights: number; totalPrice: number; currency: string; checkIn: string; checkOut: string };
export type BookingHotel = { id: string; name: string; checkInTime: string; checkOutTime: string; availableRooms?: AvailableRoom[] };
type Booking = { id: string; holdExpiresAt: string; totalAmount: number; currency: string };

const STEPS = ["Guests", "Summary", "Policies", "Payment"];

type Props = { hotel: BookingHotel; rooms: AvailableRoom[]; checkIn: string; checkOut: string; hotelHref: string };

const guestsIn = (g: RoomGuests) => g.adults + g.childrenAges.length;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The first broken Guests rule (HTL-16, openapi "every room needs at least one guest"), or null. */
export function guestsError(rooms: AvailableRoom[], guests: Record<string, RoomGuests>): string | null {
  const of = (room: AvailableRoom) => guests[room.id];
  if (rooms.some((room) => of(room).childrenAges.some((age) => !Number.isInteger(age) || age < 0 || age > 17))) return "Enter each child's age (0 to 17).";
  if (rooms.some((room) => guestsIn(of(room)) === 0)) return "Each room needs at least one guest.";
  if (rooms.reduce((sum, room) => sum + of(room).adults, 0) < 1) return "At least one adult is required.";
  if (rooms.some((room) => guestsIn(of(room)) > room.maxOccupancy)) return "A room has more guests than its maximum occupancy.";
  return null;
}

export function HotelBookingSummary({ hotel, rooms, checkIn, checkOut, hotelHref }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [guests, setGuests] = useState<Record<string, RoomGuests>>(() => Object.fromEntries(rooms.map((room) => [room.id, { adults: 1, childrenAges: [] }])));
  const [booking, setBooking] = useState<Booking | null>(null);
  const [policies, setPolicies] = useState<BookingPolicies | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [holdFailed, setHoldFailed] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  // HTL-16: total = sum over rooms of nights x that room's price.
  const total = rooms.reduce((sum, room) => sum + room.totalPrice, 0);
  const currency = rooms[0].currency;

  function toSummary() {
    const problem = guestsError(rooms, guests);
    setError(problem);
    if (!problem) setStep(1);
  }

  async function loadPolicies(bookingId: string) {
    setBusy(true);
    setError(null);
    try {
      setPolicies(await apiFetch<BookingPolicies>(`/api/bookings/hotel/${bookingId}/policies`));
    } catch {
      setError("We couldn't load the policies.");
    } finally {
      setBusy(false);
    }
  }

  async function proceed() {
    setBusy(true);
    setHoldFailed(null);
    let created: Booking;
    try {
      created = await apiFetch<Booking>("/api/hotel-bookings", {
        method: "POST",
        json: { hotelId: hotel.id, checkIn, checkOut, rooms: rooms.map((room) => ({ roomId: room.id, adults: guests[room.id].adults, childrenAges: guests[room.id].childrenAges })) },
      });
    } catch (cause) {
      setHoldFailed(cause instanceof ApiError ? cause.message : "We couldn't hold these rooms. Try again.");
      setBusy(false);
      return;
    }
    setBooking(created);
    setStep(2);
    toast.success("Rooms held for 10 minutes");
    // A refresh from here on goes to P-16 with this booking (no second hold). Native replaceState changes
    // only the URL; router.replace would render the server page again, which redirects on bookingId.
    const url = new URL(window.location.href);
    url.searchParams.set("bookingId", created.id);
    window.history.replaceState(null, "", url);
    await loadPolicies(created.id);
  }

  const aside = booking ? <HoldCountdown bookingType="hotel" expiresAt={booking.holdExpiresAt} onExpire={() => setExpired(true)} /> : undefined;

  return (
    <WizardLayout steps={STEPS} current={step} aside={aside}>
      {step === 0 && (
        <div className="grid gap-6">
          <h2 className="text-lg font-semibold">Guests per room</h2>
          {rooms.map((room) => (
            <GuestsPerRoom key={room.id} roomNumber={room.roomNumber} maxOccupancy={room.maxOccupancy} value={guests[room.id]} onChange={(value) => setGuests((current) => ({ ...current, [room.id]: value }))} />
          ))}
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
          <Button className="justify-self-end" onClick={toSummary}>Continue</Button>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-6">
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold">{hotel.name}</h2>
            <p className="text-muted-foreground">{checkIn} to {checkOut}</p>
            <p className="text-sm text-muted-foreground">Check-in from {hotel.checkInTime}; check-out by {hotel.checkOutTime}.</p>
          </div>
          <ul className="grid gap-3">
            {rooms.map((room) => {
              const g = guests[room.id];
              return (
                <li key={room.id} className="grid gap-1 rounded-lg border border-border p-4">
                  <span className="font-semibold">Room {room.roomNumber} · {room.type}</span>
                  <span className="text-sm text-muted-foreground">
                    {plural(g.adults, "adult")}
                    {g.childrenAges.length > 0 && ` · ${plural(g.childrenAges.length, "child")} (ages ${g.childrenAges.join(", ")})`}
                  </span>
                  <span className="flex flex-wrap items-center gap-1 text-sm">
                    {plural(room.nights, "night")} × <Price cents={room.pricePerNight} currency={room.currency} size="sm" hideCode /> = <Price cents={room.totalPrice} currency={room.currency} size="sm" />
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <span className="font-semibold">Total</span>
            <Price cents={total} currency={currency} size="lg" />
          </div>
          {holdFailed && (
            <div role="alert" className="grid gap-1 text-sm text-error">
              <p>{holdFailed}</p>
              <Link href={hotelHref} className="font-medium text-link hover:underline">Back to the hotel</Link>
            </div>
          )}
          <div className="flex flex-wrap justify-between gap-3">
            <Button variant="outline" onClick={() => setStep(0)} disabled={busy}>Back</Button>
            <Button onClick={proceed} loading={busy}>Proceed to payment</Button>
          </div>
        </div>
      )}

      {step === 2 && booking && (
        <div className="grid gap-6">
          {expired && <p role="alert" className="text-sm text-error">The room hold has expired. Please search again.</p>}
          {policies ? (
            <PolicyAcceptance data={policies} onAccepted={() => router.push(`/checkout/hotel/${booking.id}`)} />
          ) : (
            error && (
              <div role="alert" className="grid justify-items-start gap-3 text-sm text-error">
                <p>{error}</p>
                <Button variant="outline" onClick={() => loadPolicies(booking.id)} loading={busy}>Try again</Button>
              </div>
            )
          )}
        </div>
      )}
    </WizardLayout>
  );
}
