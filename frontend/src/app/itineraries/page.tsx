// P-27 Explore itineraries: /itineraries
// Part: Lead (foundation)
// Requirements: ITN-21, GEN-12
// Endpoints: GET /api/itineraries/public/search; GET /api/countries; GET /api/cities
// Rendering: Dynamic SSR. Source: .md section 9 "Public Itinerary Search".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-27). Use a shell and kit components (frontend/README.md).
// Built (24 Nov): keyword (title, country or city), min/max days, country, city (FilterPanel), the criteria in the
// URL, 10 per page (GEN-05), empty state (GEN-04). Guests and every role can open it (PublicShell with the session).
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import type { City, Country } from "@/components/app/search/hotel-search-form";
import { PublicShell } from "@/components/layout/public-shell";
import { allPages } from "@/lib/all-pages";
import { backendJson } from "@/lib/server/backend";
import { getSessionUser, getUnreadCount } from "@/lib/server/session";
import { ItineraryResults, ItinerarySearchFilters, type ItineraryPage } from "./itinerary-search";
import { parseItinerarySearch, searchQuery } from "./search-params";

const DESCRIPTION = "Browse public itineraries shared by other travelers: days, activities and budgets.";

export const metadata: Metadata = {
  title: "Explore itineraries",
  description: DESCRIPTION,
  alternates: { canonical: "/itineraries" },
};

type Page<T> = { items: T[]; totalPages: number };
const list = <T,>(path: string) => allPages((page) => backendJson<Page<T>>(`${path}?page=${page}`));

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { filters, page } = parseItinerarySearch(await searchParams);
  const query = searchQuery(filters, page);
  const [user, data, countries, cities] = await Promise.all([
    getSessionUser(),
    backendJson<ItineraryPage>(`/api/itineraries/public/search${query ? `?${query}` : ""}`),
    list<Country>("/api/countries"),
    list<City>("/api/cities"),
  ]);
  if (!data) throw new Error("Could not load the itineraries");
  const unread = user ? await getUnreadCount() : 0;
  const countryNames = Object.fromEntries(countries.map((c) => [c.code, c.name]));

  return (
    <PublicShell user={user} unreadNotifications={unread}>
      <PageHeader title="Explore itineraries" description={DESCRIPTION} />
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside>
          <ItinerarySearchFilters key={query} initial={filters} countries={countries} cities={cities} />
        </aside>
        <ItineraryResults data={data} filters={filters} countryNames={countryNames} />
      </div>
    </PublicShell>
  );
}
