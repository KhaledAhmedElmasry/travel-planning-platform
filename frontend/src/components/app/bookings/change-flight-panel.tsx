"use client";

// ChangeFlightPanel
// Part: Lead (foundation)
// Requirements: FLT-27 (Bonus)
// Used by: P-21
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
//
// <ChangeFlightPanel booking={details} />   (a Confirmed booking, see P-21)
// FLT-27: move one flight of the booking (outbound or return) to another flight on the same route
// and in the same cabin. The search reuses GET /api/flights/search and FlightResultCard. The fare
// difference shown before confirming is the new cabin total for the booking's passengers minus
// the old one (infants pay 10%, FLT-12); the backend reprices the same way and its `fareChange`
// is what the toast reports. A higher fare is paid with a card: Stripe Elements turns the card
// into a payment method id (card data never reaches our backend, PAY-01), sent as
// `paymentMethodId` with PATCH /api/flight-bookings/{id}/change-flight.
// Texts accepted as built (team leader decision 24 Nov - wording).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { CARD_OPTIONS } from "@/components/app/checkout/stripe-payment-panel";
import { loadStripe } from "@stripe/stripe-js";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { FormField } from "@/components/app/form-field";
import { Price } from "@/components/app/price";
import { FlightResultCard, type FlightSearchItem } from "@/components/app/search/flight-result-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ApiError, apiFetch } from "@/lib/api";
import { formatCents } from "@/lib/format";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

/** The booking fields the change needs (GET /api/flight-bookings/{id}). */
export type ChangeableBooking = {
  id: string;
  currency: string;
  segments: {
    flightId: string;
    flightNumber: string;
    departureAirport: string;
    arrivalAirport: string;
    cabinClass: string;
    /** Cabin price per seat at booking time, cents. */
    fare: number;
  }[];
  passengers: { type: string }[];
};

type FareChange = { direction: "charged" | "refunded" | "none"; amount: number; currency: string };
type Picked = { flight: FlightSearchItem; total: number };

/** What the booking's passengers pay for one flight at `fare` (infants 10%, FLT-12). */
function segmentTotal(fare: number, passengers: { type: string }[]): number {
  return passengers.reduce((sum, p) => sum + (p.type === "infant" ? Math.round(fare / 10) : fare), 0);
}

function changedMessage(change: FareChange): string {
  const money = formatCents(change.amount, change.currency);
  if (change.direction === "charged") return `Flight changed. ${money} charged.`;
  if (change.direction === "refunded") return `Flight changed. ${money} will be refunded.`;
  return "Flight changed.";
}

export function ChangeFlightPanel({ booking }: { booking: ChangeableBooking }) {
  const router = useRouter();
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [date, setDate] = useState("");
  const [results, setResults] = useState<FlightSearchItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const segment = booking.segments[segmentIndex];
  const count = (type: string) => booking.passengers.filter((p) => p.type === type).length;

  async function search() {
    setSearching(true);
    setPicked(null);
    const query = new URLSearchParams({
      origin: segment.departureAirport,
      destination: segment.arrivalAirport,
      departureDate: date,
      adults: String(count("adult")),
      children: String(count("child")),
      infants: String(count("infant")),
      cabinClass: segment.cabinClass,
    });
    try {
      // shortcut: first page of results only (10 flights on one route and day), add paging if needed.
      const page = await apiFetch<{ items: FlightSearchItem[] }>(`/api/flights/search?${query}`);
      setResults(page.items.filter((f) => f.id !== segment.flightId));
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setSearching(false);
    }
  }

  async function change(paymentMethodId?: string) {
    try {
      const res = await apiFetch<{ fareChange: FareChange }>(`/api/flight-bookings/${booking.id}/change-flight`, {
        method: "PATCH",
        json: {
          segment: segmentIndex === 0 ? "outbound" : "return",
          newFlightId: picked!.flight.id,
          ...(paymentMethodId ? { paymentMethodId } : {}),
        },
      });
      toast.success(changedMessage(res.fareChange));
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    }
  }

  const difference = picked ? picked.total - segmentTotal(segment.fare, booking.passengers) : 0;

  return (
    <div className="grid gap-4">
      {booking.segments.length > 1 && (
        <RadioGroup
          value={String(segmentIndex)}
          onValueChange={(v) => {
            setSegmentIndex(Number(v));
            setResults(null);
            setPicked(null);
          }}
          className="grid gap-2"
        >
          {booking.segments.map((s, i) => (
            <div key={s.flightId} className="flex items-center gap-2">
              <RadioGroupItem id={`change-segment-${i}`} value={String(i)} />
              <Label htmlFor={`change-segment-${i}`}>
                {i === 0 ? "Outbound flight" : "Return flight"} {s.flightNumber}
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <FormField label="New date" name="newDate">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>
        <Button onClick={search} loading={searching} disabled={!date}>
          Search flights
        </Button>
      </div>

      {results?.length === 0 && <EmptyState compact title="No other flights on this date" />}
      {results?.map((flight) => (
        <FlightResultCard
          key={flight.id}
          flight={flight}
          selectedCabin={picked?.flight.id === flight.id ? (segment.cabinClass as "economy") : undefined}
          onSelect={(f, cabinClass) =>
            setPicked({ flight: f, total: f.cabins.find((c) => c.cabinClass === cabinClass)!.totalPrice })
          }
        />
      ))}

      {picked && (
        <section aria-label="Fare difference" className="grid gap-3 rounded-xl border border-border bg-card p-4">
          {difference > 0 ? (
            <Elements stripe={stripePromise}>
              <p className="flex items-baseline gap-2">
                To pay <Price cents={difference} currency={booking.currency} size="lg" />
              </p>
              <PayAndChange onPaymentMethod={change} />
            </Elements>
          ) : (
            <>
              <p className="flex items-baseline gap-2">
                {difference < 0 ? (
                  <>
                    Refund <Price cents={-difference} currency={booking.currency} size="lg" />
                  </>
                ) : (
                  "Same fare: nothing to pay."
                )}
              </p>
              <ChangeButton label="Change flight" onClick={() => change()} />
            </>
          )}
        </section>
      )}
    </div>
  );
}

function ChangeButton({ label, onClick }: { label: string; onClick: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      loading={busy}
      onClick={async () => {
        setBusy(true);
        await onClick();
        setBusy(false);
      }}
    >
      {label}
    </Button>
  );
}

function PayAndChange({ onPaymentMethod }: { onPaymentMethod: (id: string) => Promise<void> }) {
  const stripe = useStripe();
  const elements = useElements();
  async function pay() {
    const card = elements?.getElement(CardElement);
    if (!stripe || !card) return;
    const { paymentMethod, error } = await stripe.createPaymentMethod({ type: "card", card });
    if (error || !paymentMethod) {
      toast.error(error?.message ?? "The card could not be used.");
      return;
    }
    await onPaymentMethod(paymentMethod.id);
  }
  return (
    <>
      <div className="rounded-lg border border-input p-3">
        <CardElement options={CARD_OPTIONS} />
      </div>
      <ChangeButton label="Pay and change flight" onClick={pay} />
    </>
  );
}
