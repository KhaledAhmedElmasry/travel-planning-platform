// Airline moderator home (ACC-04; spec section 2, Airline Moderator row): upcoming flights with
// seats remaining (5, team leader 24 Nov), stat cards, quick actions. No notifications block
// (team leader 24 Nov: the header bell covers it).
// `flights` = every Scheduled flight of the airline (GET /api/airlines/{id}/flights?status=scheduled,
// all pages), soonest departure first as the backend returns them.
import Link from "next/link";
import { LuggageIcon, PlaneIcon, PlusIcon, ScrollTextIcon, TicketsIcon } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { HOME_LIST_SIZE, HomeList, HomeListRow, HomeSection, QuickActions } from "@/components/app/home-section";
import { CABIN_LABEL, type CabinClass } from "@/components/app/search/flight-search-form";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";

/** One flight of GET /api/airlines/{id}/flights (backend FlightResponse). */
export type AirlineFlight = {
  id: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureLocal: string;
  status: string;
  cabins: {
    id: string;
    cabinClass: string;
    seats: number;
    bookedSeats: number;
    heldSeats: number;
    availableSeats: number;
    price: number;
    freeBags: number;
    maxBagWeightKg: number;
  }[];
};

export function AirlineOverview({ flights }: { flights: AirlineFlight[] }) {
  const seatsLeft = flights.reduce(
    (sum, flight) => sum + flight.cabins.reduce((cabinSum, cabin) => cabinSum + cabin.availableSeats, 0),
    0,
  );
  return (
    <div className="grid gap-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Scheduled flights" value={flights.length} icon={PlaneIcon} href="/airline/flights" />
        <StatCard label="Seats left" value={seatsLeft} icon={TicketsIcon} />
        {/* TODO(ask team leader): the "bookings" stat card (spec section 2): count of what (confirmed
            bookings, booked seats?) over which flights? No endpoint gives an airline's booking count. */}
      </div>
      <HomeSection title="Upcoming flights" seeAll={flights.length > 0 ? "/airline/flights" : undefined}>
        {flights.length === 0 ? (
          <EmptyState
            compact
            title="No upcoming flights"
            action={
              <Button asChild>
                <Link href="/airline/flights/new">Create flight</Link>
              </Button>
            }
          />
        ) : (
          <HomeList>
            {flights.slice(0, HOME_LIST_SIZE).map((flight) => (
              <HomeListRow key={flight.id} href={`/airline/flights/${flight.id}`}>
                <span className="font-semibold">
                  {flight.flightNumber}{" "}
                  <span className="font-normal text-muted-foreground">
                    {flight.departureAirport} → {flight.arrivalAirport}
                  </span>
                </span>
                <span className="tabular text-sm">{flight.departureLocal.replace("T", " ")}</span>
                <span className="w-full text-sm text-muted-foreground">
                  {flight.cabins
                    .map((cabin) => `${CABIN_LABEL[cabin.cabinClass as CabinClass] ?? cabin.cabinClass} ${cabin.availableSeats}`)
                    .join(" · ")}
                </span>
              </HomeListRow>
            ))}
          </HomeList>
        )}
      </HomeSection>
      <QuickActions
        actions={[
          { label: "Create flight", href: "/airline/flights/new", icon: PlusIcon },
          { label: "Baggage policy", href: "/airline/baggage-policy", icon: LuggageIcon },
          { label: "Cancellation policy", href: "/airline/cancellation-policy", icon: ScrollTextIcon },
        ]}
      />
    </div>
  );
}
