// <FlightBookingSummary flights={[outbound, back]} cabins={["economy", "business"]} counts={{ adults: 2, children: 0, infants: 0 }} searchHref="/flights" />
// FlightBookingSummary
// Part: T1 Flights + itinerary list
// Requirements: FLT-21, FLT-12
// Used by: P-14
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Built from kit parts (design-system/yallaway/MASTER.md 6.2).
// The P-14 wizard, same flow as P-19 (HotelBookingSummary): Step 1 Passengers (counts, then a
// PassengerCard each, FLT-19) → "Continue" asks the backend for the summary without holding anything
// (POST /api/flight-bookings, FLT-21) → Step 2 Summary (flights, passengers, fares, baggage fees, total)
// → "Proceed to payment" holds the seats for 10 minutes (POST /api/flight-bookings/hold, FLT-22) →
// Step 3 Policies (PAY-02) → P-16 payment. After the hold the booking id goes into the URL, so a refresh
// resumes on P-16 instead of holding again.
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiFetch } from "@/lib/api";
import { fieldErrorMap } from "@/lib/api-error";
import { FormErrorSummary } from "@/components/app/form-error-summary";
import { HoldCountdown } from "@/components/app/hold-countdown";
import { LocalTime } from "@/components/app/local-time";
import { NumberStepper } from "@/components/app/number-stepper";
import { Price } from "@/components/app/price";
import { PolicyAcceptance, type BookingPolicies } from "@/components/app/checkout/policy-acceptance";
import { CABIN_LABEL, type CabinClass } from "@/components/app/search/flight-search-form";
import { WizardLayout } from "@/components/layout/wizard-layout";
import { Button } from "@/components/ui/button";
import {
  PASSENGER_LABEL,
  PassengerCard,
  passengerErrors,
  type BaggageRules,
  type PassengerInput,
  type PassengerType,
} from "./passenger-card";

type Airport = { iataCode: string; name: string; timeZone: string };

/** The part of GET /api/flights/{id} (FlightDetails) the wizard needs. */
export type BookingFlight = {
  id: string;
  airline: { name: string };
  flightNumber: string;
  departureAirport: Airport;
  arrivalAirport: Airport;
  departureLocal: string;
  departureAt: string;
  arrivalAt: string;
  cabins: { cabinClass: CabinClass; price: number; maxBagWeightKg: number }[];
  extraBaggage: { extraBagPrice: number; maxExtraBagsPerPassenger: number };
  currency: string;
};

export type PassengerCounts = { adults: number; children: number; infants: number };

/** POST /api/flight-bookings (openapi FlightBookingQuote). Amounts in cents. */
type Quote = {
  passengers: { type: PassengerType; fullName: string; fare: number; baggageFee: number; extraBags?: { weightKg: number }[] }[];
  seats: number;
  totalAmount: number;
  currency: string;
};
type Booking = { id: string; holdExpiresAt: string; totalAmount: number; currency: string };

const STEPS = ["Passengers", "Summary", "Policies", "Payment"];

type Props = {
  /** One flight for one-way, the outbound then the return flight for a round trip (FLT-12). */
  flights: BookingFlight[];
  /** The cabin of each flight, in the same order. */
  cabins: CabinClass[];
  counts: PassengerCounts;
  /** Where "Back to the search" goes when the hold is refused. */
  searchHref: string;
};

const blank = (type: PassengerType): PassengerInput => ({ type, fullName: "", dateOfBirth: "", passportNumber: "", extraBags: [] });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Adults first, then children, then infants, keeping what was already typed for each. */
function resize(current: PassengerInput[], counts: PassengerCounts): PassengerInput[] {
  const of = (type: PassengerType, n: number) => {
    const typed = current.filter((p) => p.type === type).slice(0, n);
    return typed.concat(Array.from({ length: n - typed.length }, () => blank(type)));
  };
  return [...of("adult", counts.adults), ...of("child", counts.children), ...of("infant", counts.infants)];
}

/** The request body of POST /api/flight-bookings and /hold (FlightBookingRequest). */
function requestBody(flights: BookingFlight[], cabins: CabinClass[], passengers: PassengerInput[]) {
  return {
    segments: flights.map((f, i) => ({ flightId: f.id, cabinClass: cabins[i] })),
    passengers: passengers.map((p) => ({
      type: p.type,
      fullName: p.fullName.trim(),
      dateOfBirth: p.dateOfBirth,
      passportNumber: p.passportNumber.trim(),
      ...(p.extraBags.length > 0 ? { extraBags: p.extraBags.map((weightKg) => ({ weightKg })) } : {}),
    })),
  };
}

export function FlightBookingSummary({ flights, cabins, counts: initialCounts, searchHref }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [counts, setCounts] = useState<PassengerCounts>(initialCounts);
  const [passengers, setPassengers] = useState<PassengerInput[]>(() => resize([], initialCounts));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [policies, setPolicies] = useState<BookingPolicies | null>(null);
  const [busy, setBusy] = useState(false);
  const [holdFailed, setHoldFailed] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  // FLT-12: passenger types are fixed on the outbound departure date.
  const departureDate = flights[0].departureLocal.slice(0, 10);
  // FLT-08: the strictest extra-baggage rules of the booked flights and cabins.
  const baggage: BaggageRules = {
    extraBagPrice: Math.max(...flights.map((f) => f.extraBaggage.extraBagPrice)),
    maxExtraBags: Math.min(...flights.map((f) => f.extraBaggage.maxExtraBagsPerPassenger)),
    maxBagWeightKg: Math.min(...flights.map((f, i) => f.cabins.find((c) => c.cabinClass === cabins[i])?.maxBagWeightKg ?? 0)),
    currency: flights[0].currency,
  };

  function changeCounts(next: PassengerCounts) {
    // FLT-12: at least one adult, and no more infants than adults.
    const fixed = { ...next, infants: Math.min(next.infants, next.adults) };
    setCounts(fixed);
    setPassengers((current) => resize(current, fixed));
    setErrors({});
  }

  async function toSummary() {
    setMessage(null);
    const problems = passengerErrors(passengers, baggage, departureDate);
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;
    setBusy(true);
    try {
      setQuote(await apiFetch<Quote>("/api/flight-bookings", { method: "POST", json: requestBody(flights, cabins, passengers) }));
      setStep(1);
    } catch (cause) {
      const fields = fieldErrorMap(cause instanceof ApiError ? cause.body : null);
      setErrors(fields);
      setMessage(cause instanceof ApiError ? cause.message : "We couldn't check these details. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function loadPolicies(bookingId: string) {
    setBusy(true);
    setMessage(null);
    try {
      setPolicies(await apiFetch<BookingPolicies>(`/api/bookings/flight/${bookingId}/policies`));
    } catch {
      setMessage("We couldn't load the policies.");
    } finally {
      setBusy(false);
    }
  }

  async function proceed() {
    setBusy(true);
    setHoldFailed(null);
    let created: Booking;
    try {
      created = await apiFetch<Booking>("/api/flight-bookings/hold", { method: "POST", json: requestBody(flights, cabins, passengers) });
    } catch (cause) {
      setHoldFailed(cause instanceof ApiError ? cause.message : "We couldn't hold these seats. Try again.");
      setBusy(false);
      return;
    }
    setBooking(created);
    setStep(2);
    toast.success("Seats held for 10 minutes");
    // A refresh from here on goes to P-16 with this booking (no second hold). Native replaceState changes
    // only the URL; router.replace would render the server page again, which redirects on bookingId.
    const url = new URL(window.location.href);
    url.searchParams.set("bookingId", created.id);
    window.history.replaceState(null, "", url);
    await loadPolicies(created.id);
  }

  const aside = booking ? (
    <HoldCountdown bookingType="flight" expiresAt={booking.holdExpiresAt} onExpire={() => setExpired(true)} />
  ) : undefined;
  const numberOf = (index: number) => passengers.slice(0, index + 1).filter((p) => p.type === passengers[index].type).length;

  return (
    <WizardLayout steps={STEPS} current={step} aside={aside}>
      {step === 0 && (
        <div className="grid gap-6">
          <FlightList flights={flights} cabins={cabins} />
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberStepper
              label="Adults"
              hint="12+"
              value={counts.adults}
              min={1}
              onChange={(adults) => changeCounts({ ...counts, adults })}
            />
            <NumberStepper
              label="Children"
              hint="2-11"
              value={counts.children}
              min={0}
              onChange={(children) => changeCounts({ ...counts, children })}
            />
            <NumberStepper
              label="Infants"
              hint="Under 2, on a lap"
              value={counts.infants}
              min={0}
              max={counts.adults}
              onChange={(infants) => changeCounts({ ...counts, infants })}
            />
          </div>
          {Object.keys(errors).length > 1 && <FormErrorSummary errors={errors} />}
          {passengers.map((passenger, index) => (
            <PassengerCard
              key={`${passenger.type}-${numberOf(index)}`}
              index={index}
              number={numberOf(index)}
              value={passenger}
              onChange={(value) => setPassengers((current) => current.map((p, i) => (i === index ? value : p)))}
              errors={errors}
              baggage={baggage}
              departureDate={departureDate}
            />
          ))}
          {message && (
            <p role="alert" className="text-sm text-error">
              {message}
            </p>
          )}
          <Button className="justify-self-end" onClick={toSummary} loading={busy}>
            Continue
          </Button>
        </div>
      )}

      {step === 1 && quote && (
        <div className="grid gap-6">
          <FlightList flights={flights} cabins={cabins} />
          <ul className="grid gap-3">
            {quote.passengers.map((p, index) => (
              <li key={index} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-4">
                <div className="grid gap-0.5">
                  <span className="font-semibold">{p.fullName}</span>
                  <span className="text-sm text-muted-foreground">
                    {PASSENGER_LABEL[p.type]}
                    {p.type === "infant" && " · no seat, 10% of the fare"}
                    {(p.extraBags?.length ?? 0) > 0 && ` · ${plural(p.extraBags!.length, "extra bag")}`}
                  </span>
                </div>
                <div className="grid justify-items-end text-sm">
                  <Price cents={p.fare} currency={quote.currency} size="sm" />
                  {p.baggageFee > 0 && (
                    <span className="text-muted-foreground">
                      + <Price cents={p.baggageFee} currency={quote.currency} size="sm" hideCode /> bags
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <span className="font-semibold">
              Total · {plural(quote.seats, "seat")}
            </span>
            <Price cents={quote.totalAmount} currency={quote.currency} size="lg" />
          </div>
          {holdFailed && (
            <div role="alert" className="grid gap-1 text-sm text-error">
              <p>{holdFailed}</p>
              <Link href={searchHref} className="font-medium text-link hover:underline">
                Back to the search
              </Link>
            </div>
          )}
          <div className="flex flex-wrap justify-between gap-3">
            <Button variant="outline" onClick={() => setStep(0)} disabled={busy}>
              Back
            </Button>
            <Button onClick={proceed} loading={busy}>
              Proceed to payment
            </Button>
          </div>
        </div>
      )}

      {step === 2 && booking && (
        <div className="grid gap-6">
          {expired && (
            <p role="alert" className="text-sm text-error">
              The seat hold has expired. Please search again.
            </p>
          )}
          {policies ? (
            <PolicyAcceptance data={policies} onAccepted={() => router.push(`/checkout/flight/${booking.id}`)} />
          ) : (
            message && (
              <div role="alert" className="grid justify-items-start gap-3 text-sm text-error">
                <p>{message}</p>
                <Button variant="outline" onClick={() => loadPolicies(booking.id)} loading={busy}>
                  Try again
                </Button>
              </div>
            )
          )}
        </div>
      )}
    </WizardLayout>
  );
}

/** The booked flight(s) with the cabin and the local times in each airport's zone (GEN-06). */
function FlightList({ flights, cabins }: { flights: BookingFlight[]; cabins: CabinClass[] }) {
  return (
    <ul className="grid gap-3">
      {flights.map((f, i) => (
        <li key={f.id} className="grid gap-2 rounded-lg border border-border p-4">
          <span className="font-semibold">
            {flights.length > 1 && (i === 0 ? "Outbound · " : "Return · ")}
            {f.airline.name} {f.flightNumber} · {CABIN_LABEL[cabins[i]]}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <LocalTime iso={f.departureAt} timeZone={f.departureAirport.timeZone} airport={f.departureAirport.iataCode} showDate size="sm" />
            <ArrowRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            <LocalTime iso={f.arrivalAt} timeZone={f.arrivalAirport.timeZone} airport={f.arrivalAirport.iataCode} showDate size="sm" />
          </div>
        </li>
      ))}
    </ul>
  );
}
