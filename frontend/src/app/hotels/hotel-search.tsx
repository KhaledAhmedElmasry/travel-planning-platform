"use client";

// P-15 Hotel search client interactions (HTL-11, HTL-12, GEN-05).
import { useRouter } from "next/navigation";
import { SlidersHorizontalIcon } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PaginationBar } from "@/components/app/pagination-bar";
import { FilterPanel, type SearchFilters } from "@/components/app/search/filter-panel";
import { HotelResultCard, type HotelSearchResult } from "@/components/app/search/hotel-result-card";
import { HotelSearchForm, type City, type Country, type HotelSearchParams } from "@/components/app/search/hotel-search-form";
import { SortSelect, type SortValue } from "@/components/app/search/sort-select";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type SearchState = {
  initial: Partial<HotelSearchParams>;
  filters: SearchFilters;
  sort: SortValue;
};

type HotelPage = {
  items: HotelSearchResult[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function href(search: Partial<HotelSearchParams>, filters: SearchFilters, sort: SortValue, page: number) {
  const query = new URLSearchParams();
  if (search.city) query.set("city", search.city);
  if (search.country) query.set("country", search.country);
  if (search.checkIn) query.set("checkIn", search.checkIn);
  if (search.checkOut) query.set("checkOut", search.checkOut);
  if (search.guests !== undefined) query.set("guests", String(search.guests));
  if (search.rooms !== undefined) query.set("rooms", String(search.rooms));
  if (filters.minPrice !== undefined) query.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== undefined) query.set("maxPrice", String(filters.maxPrice));
  if (filters.minRating !== undefined) query.set("minRating", String(filters.minRating));
  if (sort.sortBy !== "price" || sort.sortOrder !== "asc") {
    query.set("sortBy", sort.sortBy);
    query.set("sortOrder", sort.sortOrder);
  }
  if (page > 1) query.set("page", String(page));
  return `/hotels?${query}`;
}

export function HotelSearchBox({ countries, cities, ...state }: SearchState & { countries: Country[]; cities: City[] }) {
  const router = useRouter();
  return <HotelSearchForm countries={countries} cities={cities} initial={state.initial} onSearch={(next) => router.push(href(next, state.filters, state.sort, 1))} />;
}

export function HotelFilters({ state, currency }: { state: SearchState; currency: string }) {
  const router = useRouter();
  const panel = <FilterPanel kind="hotels" currency={currency} initial={state.filters} onApply={(next) => router.push(href(state.initial, next, state.sort, 1))} />;
  return (
    <>
      <div className="hidden lg:block">{panel}</div>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" className="lg:hidden"><SlidersHorizontalIcon aria-hidden />Filters</Button>
        </SheetTrigger>
        <SheetContent side="left" className="overflow-y-auto">
          <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
          <div className="px-4 pb-4">{panel}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function HotelResults({ result, state, cityNames, countryNames }: { result: HotelPage; state: SearchState; cityNames: Record<string, string>; countryNames: Record<string, string> }) {
  const router = useRouter();
  const sort = <SortSelect kind="hotels" value={state.sort} onChange={(next) => router.push(href(state.initial, state.filters, next, 1))} />;
  if (result.items.length === 0) {
    return <EmptyState title="No hotels found" line="Nothing here... try other dates?" pose="shrug" />;
  }
  return (
    <div className="grid gap-6">
      {sort}
      <div className="grid gap-4">
        {result.items.map((hotel) => (
          <HotelResultCard
            key={hotel.id}
            hotel={hotel}
            cityName={cityNames[hotel.cityId] ?? hotel.cityId}
            countryName={countryNames[hotel.countryCode] ?? hotel.countryCode}
            search={state.initial as Pick<HotelSearchParams, "checkIn" | "checkOut" | "guests" | "rooms">}
          />
        ))}
      </div>
      <PaginationBar page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} hrefFor={(page) => href(state.initial, state.filters, state.sort, page)} />
    </div>
  );
}

