"use client";

// P-12 (FLT-11, FLT-12, FLT-15, GEN-06): the parts of the flight search that run in the browser.
// The form, the filters and the sort put the criteria in the URL, so the server page searches
// again (Dynamic SSR). Choosing a cabin opens P-14 Book a flight with the choice in its URL;
// P-14 asks a guest to log in first and comes back (ACC-10).
import { useRouter } from "next/navigation";
import { SlidersHorizontalIcon } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PaginationBar } from "@/components/app/pagination-bar";
import { FilterPanel, type SearchFilters } from "@/components/app/search/filter-panel";
import { FlightResultCard, type FlightSearchItem } from "@/components/app/search/flight-result-card";
import { FlightSearchForm, type Airport, type CabinClass, type FlightSearchParams } from "@/components/app/search/flight-search-form";
import { RoundTripSelector, type FlightChoice } from "@/components/app/search/round-trip-selector";
import { SortSelect, type SortValue } from "@/components/app/search/sort-select";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { searchQuery } from "./search-params";

/** One page of GET /api/flights/search (GEN-05). */
export type FlightPage = { items: FlightSearchItem[]; page: number; pageSize: number; total: number; totalPages: number };
/** One-way: a page. Round trip: one page of outbound and one of return flights (openapi). */
export type FlightSearchResult = FlightPage | { outbound: FlightPage; return: FlightPage };

const DEFAULT_SORT: SortValue = { sortBy: "price", sortOrder: "asc" };

const href = (criteria: Partial<FlightSearchParams>, filters: SearchFilters, sort: SortValue | undefined, page: number) => {
  const query = searchQuery(criteria, filters, sort, page);
  return query ? `/flights?${query}` : "/flights";
};

/** P-14 with the chosen flight(s), cabin(s) and passengers in the URL. */
export function bookingHref(criteria: FlightSearchParams, outbound: FlightChoice, back?: FlightChoice): string {
  const query = new URLSearchParams({
    cabinClass: outbound.cabinClass,
    adults: String(criteria.adults),
    children: String(criteria.children),
    infants: String(criteria.infants),
  });
  if (back) {
    query.set("returnFlightId", back.flight.id);
    query.set("returnCabinClass", back.cabinClass);
  }
  return `/flights/${outbound.flight.id}/book?${query}`;
}

type SearchState = {
  initial: Partial<FlightSearchParams>;
  filters: SearchFilters;
  sort?: SortValue;
};

export function FlightSearchBox({ airports, initial, filters, sort }: SearchState & { airports: Airport[] }) {
  const router = useRouter();
  // A new search keeps the price filter and the sort (FLT-15) and starts on page 1.
  return <FlightSearchForm airports={airports} initial={initial} onSearch={(params) => router.push(href(params, filters, sort, 1))} />;
}

export function FlightFilters({ initial, filters, sort, currency }: SearchState & { currency: string }) {
  const router = useRouter();
  // Applying a filter keeps every search criterion (FLT-15) and starts on page 1.
  const panel = (
    <FilterPanel kind="flights" currency={currency} initial={filters} onApply={(next) => router.push(href(initial, next, sort, 1))} />
  );
  return (
    <>
      <div className="hidden lg:block">{panel}</div>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" className="lg:hidden">
            <SlidersHorizontalIcon aria-hidden />
            Filters
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">{panel}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function FlightResults({
  criteria,
  filters,
  sort,
  result,
}: SearchState & { criteria: FlightSearchParams; result: FlightSearchResult }) {
  const router = useRouter();
  const pageHref = (page: number) => href(criteria, filters, sort, page);
  const sortSelect = (
    <SortSelect kind="flights" value={sort ?? DEFAULT_SORT} onChange={(next) => router.push(href(criteria, filters, next, 1))} />
  );

  if ("outbound" in result) {
    // Round trip (FLT-12): one flight and cabin of each list, booked together.
    const { outbound, return: back } = result;
    if (outbound.total === 0 && back.total === 0) return <NoFlights />;
    const totalPages = Math.max(outbound.totalPages, back.totalPages);
    return (
      <div className="grid gap-6">
        {sortSelect}
        <RoundTripSelector
          outbound={outbound.items}
          returns={back.items}
          onContinue={(choice) => router.push(bookingHref(criteria, choice.outbound, choice.return))}
        />
        <PaginationBar page={outbound.page} totalPages={totalPages} hrefFor={pageHref} />
      </div>
    );
  }

  if (result.items.length === 0) return <NoFlights />;
  return (
    <div className="grid gap-6">
      {sortSelect}
      <div className="grid gap-4">
        {result.items.map((flight) => (
          <FlightResultCard
            key={flight.id}
            flight={flight}
            onSelect={(f, cabinClass: CabinClass) => router.push(bookingHref(criteria, { flight: f, cabinClass }))}
          />
        ))}
      </div>
      <PaginationBar page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} hrefFor={pageHref} />
    </div>
  );
}

// GEN-04: the handout's empty state for flight search (So3ad shrugging).
function NoFlights() {
  return <EmptyState pose="shrug" title="No flights found" line="Nothing here… try other dates?" />;
}
