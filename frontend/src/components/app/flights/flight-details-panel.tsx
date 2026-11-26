// <FlightDetailsPanel flight={flight} bookHref={(cabinClass) => `/flights/${flight.id}/book?cabinClass=${cabinClass}`} />
// FlightDetailsPanel
// Part: T1 Flights + itinerary list
// Requirements: FLT-17, GEN-06
// Used by: P-13
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Built from kit parts (design-system/yallaway/MASTER.md 6.2).
// Everything GET /api/flights/{id} returns: airline, flight number, status, both airports with the
// local times in each airport's own zone (GEN-06, LocalTime), duration, each cabin with its fare,
// seats remaining and free baggage, the extra-baggage policy (FLT-08) and the cancellation tiers
// (FLT-09). A cancelled or departed flight shows why it cannot be booked and no Book button.
// Server-safe: no state, no browser APIs.
import Link from "next/link";
import { ArrowRightIcon, BriefcaseIcon, InfoIcon } from "lucide-react";
import { LocalTime } from "@/components/app/local-time";
import { Price } from "@/components/app/price";
import { StatusBadge } from "@/components/app/status-badge";
import { CABIN_LABEL, type CabinClass } from "@/components/app/search/flight-search-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type FlightAirport = { iataCode: string; name: string; cityId: string; countryCode: string; timeZone: string };

/** GET /api/flights/{id} (openapi FlightDetails). Amounts are integer cents of `currency`. */
export type FlightDetailsData = {
  id: string;
  airline: { id: string; name: string; code: string; logoUrl: string | null };
  flightNumber: string;
  status: "scheduled" | "departed" | "cancelled";
  departureAirport: FlightAirport;
  arrivalAirport: FlightAirport;
  departureAt: string;
  arrivalAt: string;
  durationMinutes: number;
  cabins: {
    cabinId: string;
    cabinClass: CabinClass;
    price: number;
    seatsRemaining: number;
    soldOut: boolean;
    freeBags: number;
    maxBagWeightKg: number;
  }[];
  extraBaggage: { extraBagPrice: number; maxExtraBagsPerPassenger: number };
  cancellationPolicy: {
    tiers: { daysBefore: number; refundPercentage: number; description: string }[];
    note: string | null;
  };
  bookable: boolean;
  bookableReason: string | null;
  currency: string;
};

type FlightDetailsPanelProps = {
  flight: FlightDetailsData;
  /** Where "Book" goes for a cabin (P-14). Left out: no Book buttons. */
  bookHref?: (cabinClass: CabinClass) => string;
};

/** 215 -> "3h 35m" */
function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function FlightDetailsPanel({ flight, bookHref }: FlightDetailsPanelProps) {
  const { departureAirport: from, arrivalAirport: to, currency } = flight;
  const bags = flight.extraBaggage;
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle>
              {flight.airline.name} · {flight.flightNumber}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {from.name} to {to.name}
            </p>
          </div>
          <StatusBadge kind="flight" status={flight.status} />
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <LocalTime iso={flight.departureAt} timeZone={from.timeZone} airport={from.iataCode} showDate />
            <div className="flex flex-col items-center text-sm text-muted-foreground">
              <ArrowRightIcon className="size-4" aria-hidden="true" />
              <span>{duration(flight.durationMinutes)}</span>
            </div>
            <LocalTime iso={flight.arrivalAt} timeZone={to.timeZone} airport={to.iataCode} showDate align="end" />
          </div>
          {!flight.bookable && (
            <p role="status" className="flex items-start gap-2 rounded-lg border border-border bg-muted p-3 text-sm">
              <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {flight.bookableReason ?? "This flight can no longer be booked."}
            </p>
          )}
        </CardContent>
      </Card>

      <section aria-labelledby="cabins-title" className="grid gap-3">
        <h2 id="cabins-title" className="text-xl font-semibold">
          Cabins and fares
        </h2>
        <ul className="grid gap-3">
          {flight.cabins.map((cabin) => (
            <li
              key={cabin.cabinId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
            >
              <div className="grid gap-1">
                <span className="flex items-center gap-2 font-medium">
                  {CABIN_LABEL[cabin.cabinClass]}
                  {cabin.soldOut && <Badge variant="secondary">Sold out</Badge>}
                </span>
                <span className="text-sm text-muted-foreground">
                  {cabin.soldOut ? "No seats left" : `${cabin.seatsRemaining} seats left`} · {cabin.freeBags} free bag
                  {cabin.freeBags === 1 ? "" : "s"} up to {cabin.maxBagWeightKg} kg
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="grid justify-items-end">
                  <Price cents={cabin.price} currency={currency} size="md" />
                  <span className="text-sm text-muted-foreground">per person</span>
                </div>
                {bookHref && flight.bookable && !cabin.soldOut && (
                  <Button asChild>
                    <Link href={bookHref(cabin.cabinClass)}>
                      Book
                      <span className="sr-only"> {CABIN_LABEL[cabin.cabinClass]}</span>
                    </Link>
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BriefcaseIcon className="size-4" aria-hidden="true" />
              Extra baggage
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {bags.maxExtraBagsPerPassenger > 0 ? (
              <p>
                <Price cents={bags.extraBagPrice} currency={currency} size="sm" /> per extra bag, up to{" "}
                {bags.maxExtraBagsPerPassenger} per passenger. Added on the booking page.
              </p>
            ) : (
              <p>This airline does not sell extra bags on this flight.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cancellation policy</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {flight.cancellationPolicy.tiers.length > 0 ? (
              <ul className="grid gap-2">
                {flight.cancellationPolicy.tiers.map((tier) => (
                  <li key={tier.daysBefore}>{tier.description}</li>
                ))}
              </ul>
            ) : (
              <p>No refund on cancellation.</p>
            )}
            {flight.cancellationPolicy.note && (
              <>
                <Separator />
                <p className="text-muted-foreground">{flight.cancellationPolicy.note}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
