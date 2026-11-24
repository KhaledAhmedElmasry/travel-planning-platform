"use client";

// P-27 (ITN-21): the filter panel (keyword, min/max days, country, city) and the results.
// Apply / Reset put the criteria in the URL, so the server page searches again (Dynamic SSR).
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { PaginationBar } from "@/components/app/pagination-bar";
import { FilterPanel, type SearchFilters } from "@/components/app/search/filter-panel";
import { ItineraryCard, type ItinerarySummary } from "@/components/app/shared/itinerary-card";
import { searchQuery } from "./search-params";

export type ItineraryPage = { items: ItinerarySummary[]; page: number; pageSize: number; total: number; totalPages: number };
type Country = { code: string; name: string; currency: string };
type City = { cityId: string; name: string; countryCode: string };
type PanelProps = { initial: SearchFilters; countries: Country[]; cities: City[] };

const href = (filters: SearchFilters, page: number) => {
  const query = searchQuery(filters, page);
  return query ? `/itineraries?${query}` : "/itineraries";
};

export function ItinerarySearchFilters(props: PanelProps) {
  const router = useRouter();
  return <ItinerarySearchPanel {...props} navigate={(path) => router.push(path)} />;
}

export function ItinerarySearchPanel({ initial, countries, cities, navigate }: PanelProps & { navigate: (path: string) => void }) {
  // A new search always starts on page 1.
  return <FilterPanel kind="itineraries" initial={initial} countries={countries} cities={cities} onApply={(filters) => navigate(href(filters, 1))} />;
}

export function ItineraryResults({
  data,
  filters,
  countryNames,
}: {
  data: ItineraryPage;
  filters: SearchFilters;
  countryNames: Record<string, string>;
}) {
  if (data.items.length === 0) {
    // source: team leader answer 24 Nov - empty-state wording
    return <EmptyState title="No itineraries found" />;
  }
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        {data.items.map((it) => (
          <ItineraryCard key={it.id} itinerary={it} countryNames={countryNames} href={`/itineraries/${it.id}`} />
        ))}
      </div>
      <PaginationBar
        page={data.page}
        totalPages={data.totalPages}
        total={data.total}
        pageSize={data.pageSize}
        hrefFor={(p) => href(filters, p)}
      />
    </div>
  );
}
