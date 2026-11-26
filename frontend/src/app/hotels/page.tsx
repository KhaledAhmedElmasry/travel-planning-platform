// P-15 Hotel search: /hotels
// Part: T2 Hotels + my posts list
// Requirements: HTL-11, HTL-12, GEN-12
// Endpoints: GET /api/hotels/search; GET /api/countries; GET /api/cities
// Rendering: Dynamic SSR. Source: .md section 9 "Flight / Hotel Search".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-15). Use a shell and kit components (frontend/README.md).
import type { Metadata } from "next";
import { ErrorState } from "@/components/app/error-state";
import { PageHeader } from "@/components/app/page-header";
import { PublicShell } from "@/components/layout/public-shell";
import { allPages } from "@/lib/all-pages";
import { backendFetch, backendJson } from "@/lib/server/backend";
import { getSessionUser, getUnreadCount } from "@/lib/server/session";
import { HotelFilters, HotelResults, HotelSearchBox } from "./hotel-search";
import type { City, Country, HotelSearchParams } from "@/components/app/search/hotel-search-form";
import type { SearchFilters } from "@/components/app/search/filter-panel";
import type { SortValue } from "@/components/app/search/sort-select";
import type { HotelSearchResult } from "@/components/app/search/hotel-result-card";

export const metadata: Metadata = {
  title: "Hotel search",
  description: "Find hotels by destination, dates, guests and rooms.",
  alternates: { canonical: "/hotels" },
};

type Page<T> = { items: T[]; totalPages: number };
type HotelPage = { items: HotelSearchResult[]; page: number; pageSize: number; total: number; totalPages: number };
type Params = Record<string, string | string[] | undefined>;

function value(params: Params, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function positiveInt(raw: string | undefined, fallback: number) {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseParams(params: Params) {
  const city = value(params, "city");
  const country = value(params, "country");
  const checkIn = value(params, "checkIn");
  const checkOut = value(params, "checkOut");
  const guests = positiveInt(value(params, "guests"), 1);
  const rooms = positiveInt(value(params, "rooms"), 1);
  const initial: Partial<HotelSearchParams> = { ...(city ? { city } : {}), ...(country ? { country } : {}), ...(checkIn ? { checkIn } : {}), ...(checkOut ? { checkOut } : {}), guests, rooms };
  const filters: SearchFilters = {};
  for (const key of ["minPrice", "maxPrice", "minRating"] as const) {
    const parsed = Number(value(params, key));
    if (Number.isFinite(parsed) && parsed >= 0) filters[key] = parsed;
  }
  const sortBy = value(params, "sortBy");
  const sortOrder = value(params, "sortOrder");
  const sort: SortValue = {
    sortBy: sortBy === "rating" ? "rating" : "price",
    sortOrder: sortOrder === "desc" ? "desc" : "asc",
  };
  const page = positiveInt(value(params, "page"), 1);
  const criteria = Boolean((city || country) && checkIn && checkOut);
  return { initial, filters, sort, page, criteria };
}

function searchQuery(initial: Partial<HotelSearchParams>, filters: SearchFilters, sort: SortValue, page: number) {
  const query = new URLSearchParams();
  for (const key of ["city", "country", "checkIn", "checkOut"] as const) if (initial[key]) query.set(key, initial[key]!);
  for (const key of ["guests", "rooms"] as const) if (initial[key] !== undefined) query.set(key, String(initial[key]));
  for (const key of ["minPrice", "maxPrice", "minRating"] as const) if (filters[key] !== undefined) query.set(key, String(filters[key]));
  if (sort.sortBy !== "price" || sort.sortOrder !== "asc") { query.set("sortBy", sort.sortBy); query.set("sortOrder", sort.sortOrder); }
  query.set("page", String(page));
  return query.toString();
}

async function search(query: string): Promise<{ result?: HotelPage; error?: string }> {
  const response = await backendFetch(`/api/hotels/search?${query}`);
  if (response.ok) return { result: (await response.json()) as HotelPage };
  if (response.status === 400) {
    const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
    return { error: Array.isArray(body.message) ? body.message.join(" ") : body.message };
  }
  throw new Error(`GET /api/hotels/search failed with ${response.status}`);
}

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const state = parseParams(params);
  const [user, countries, cities, found] = await Promise.all([
    getSessionUser(),
    allPages((page) => backendJson<Page<Country>>(`/api/countries?page=${page}`)),
    allPages((page) => backendJson<Page<City>>(`/api/cities?page=${page}`)),
    state.criteria ? search(searchQuery(state.initial, state.filters, state.sort, state.page)) : Promise.resolve(undefined),
  ]);
  const unread = user ? await getUnreadCount() : 0;
  const cityNames = Object.fromEntries(cities.map((city) => [city.cityId, city.name]));
  const countryNames = Object.fromEntries(countries.map((country) => [country.code, country.name]));
  const currency = found?.result?.items[0]?.currency ?? "";

  return (
    <PublicShell user={user} unreadNotifications={unread}>
      <PageHeader title="Hotel search" description="Find a hotel by destination, dates, guests and rooms." />
      <div className="grid gap-8">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <HotelSearchBox key={JSON.stringify(state.initial)} countries={countries} cities={cities} initial={state.initial} filters={state.filters} sort={state.sort} />
        </div>
        {state.criteria && (
          <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
            <aside><HotelFilters key={JSON.stringify(state.filters)} state={state} currency={currency} /></aside>
            <section aria-label="Hotel search results">
              {found?.error !== undefined || !found?.result ? <ErrorState title="We couldn't search these hotels" message={found?.error} /> : <HotelResults result={found.result} state={state} cityNames={cityNames} countryNames={countryNames} />}
            </section>
          </div>
        )}
      </div>
    </PublicShell>
  );
}
