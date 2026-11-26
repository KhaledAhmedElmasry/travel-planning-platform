// FlightResultCard
// Part: Lead (foundation)
// Requirements: FLT-11, GEN-06
// Used by: P-12, P-26, P-21
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
//
// <FlightResultCard flight={item} selectedCabin={picked?.cabinClass} onSelect={(flight, cabinClass) => ...} />
// One flight of GET /api/flights/search, with a "View details" link to P-13 /flights/{id} (FLT-17). Team leader (23 Nov): one row per matching cabin with its
// own Select button; each row shows the total for the searched passengers (infants 10%, FLT-12)
// and the fare per person. Times are shown in each airport's own time zone (GEN-06).
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { LocalTime } from "@/components/app/local-time";
import { Price } from "@/components/app/price";
import { Button } from "@/components/ui/button";
import type { Airport, CabinClass } from "./flight-search-form";
import { CABIN_LABEL } from "./flight-search-form";

/** One cabin of a search result (openapi FlightSearchItem.cabins). */
export type FlightSearchCabin = {
  cabinId: string;
  cabinClass: CabinClass;
  price: number;
  availableSeats: number;
  freeBags: number;
  maxBagWeightKg: number;
  totalPrice: number;
  currency: string;
};

/** One flight of GET /api/flights/search (openapi FlightSearchItem). */
export type FlightSearchItem = {
  id: string;
  flightNumber: string;
  airline: { id: string; name: string; code: string; logoUrl: string | null };
  departureAirport: Airport;
  arrivalAirport: Airport;
  departureLocal: string;
  arrivalLocal: string;
  departureAt: string;
  arrivalAt: string;
  durationMinutes: number;
  cabins: FlightSearchCabin[];
};

type Props = {
  flight: FlightSearchItem;
  onSelect: (flight: FlightSearchItem, cabinClass: CabinClass) => void;
  /** The cabin of this flight the user already picked (round trip, change flight). */
  selectedCabin?: CabinClass;
};

function duration(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function FlightResultCard({ flight, onSelect, selectedCabin }: Props) {
  const titleId = `flight-${flight.id}-title`;
  return (
    <article aria-labelledby={titleId} className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={titleId} className="font-semibold">
          {flight.airline.name} · {flight.flightNumber}
        </h3>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{duration(flight.durationMinutes)}</span>
          {/* FLT-17: team leader (26 Nov), every result links to P-13 */}
          <Link href={`/flights/${flight.id}`} className="text-sm font-medium text-link hover:underline">
            View details
          </Link>
        </div>
      </header>
      <div className="flex items-center gap-3">
        <LocalTime
          iso={flight.departureAt}
          timeZone={flight.departureAirport.timeZone}
          airport={flight.departureAirport.iataCode}
          showDate
        />
        <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <LocalTime
          iso={flight.arrivalAt}
          timeZone={flight.arrivalAirport.timeZone}
          airport={flight.arrivalAirport.iataCode}
          showDate
          align="end"
        />
      </div>
      <ul className="grid gap-2">
        {flight.cabins.map((cabin) => {
          const selected = cabin.cabinClass === selectedCabin;
          return (
            <li
              key={cabin.cabinId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="grid gap-0.5">
                <span className="font-medium">{CABIN_LABEL[cabin.cabinClass]}</span>
                <span className="text-sm text-muted-foreground">
                  {cabin.availableSeats} seats left · {cabin.freeBags} free bag{cabin.freeBags === 1 ? "" : "s"} up to{" "}
                  {cabin.maxBagWeightKg} kg
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="grid justify-items-end">
                  <Price cents={cabin.totalPrice} currency={cabin.currency} size="lg" />
                  <span className="text-sm text-muted-foreground">
                    <Price cents={cabin.price} currency={cabin.currency} size="sm" hideCode /> per person
                  </span>
                </div>
                <Button
                  variant={selected ? "default" : "secondary"}
                  aria-pressed={selected}
                  onClick={() => onSelect(flight, cabin.cabinClass)}
                >
                  {selected ? "Selected" : "Select"}
                  <span className="sr-only"> {CABIN_LABEL[cabin.cabinClass]}</span>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
