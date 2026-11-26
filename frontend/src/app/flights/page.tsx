// P-12 Flight search: /flights
// Part: T1 Flights + itinerary list
// Requirements: FLT-11, FLT-12, FLT-15, GEN-06, FLT-02, GEN-12
// Endpoints: GET /api/airports; GET /api/flights/search
// Rendering: Dynamic SSR. Source: .md section 9 "Flight / Hotel Search".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-12). Use a shell and kit components (frontend/README.md).
// Built: search form (FlightSearchForm, airports from GET /api/airports, FLT-02/GEN-12), one-way results
// and round-trip outbound + return lists (FLT-12), price filter and sort (FLT-15), times in each airport's
// zone (GEN-06, in FlightResultCard), the criteria in the URL, 10 per page (GEN-05), empty state (GEN-04),
// loading (loading.tsx, GEN-16). Guests and every role can open it (PublicShell with the session).
import type { Metadata } from "next";
import { ErrorState } from "@/components/app/error-state";
import { PageHeader } from "@/components/app/page-header";
import type { Airport } from "@/components/app/search/flight-search-form";
import { PublicShell } from "@/components/layout/public-shell";
import { allPages } from "@/lib/all-pages";
import { backendFetch, backendJson } from "@/lib/server/backend";
import { getSessionUser, getUnreadCount } from "@/lib/server/session";
import { FlightFilters, FlightResults, FlightSearchBox, type FlightSearchResult } from "./flight-search";
import { parseFlightSearch, searchQuery } from "./search-params";

const DESCRIPTION = "Search flights between the listed airports by date, passengers and cabin.";

export const metadata: Metadata = {
  title: "Flight search",
  description: DESCRIPTION,
  alternates: { canonical: "/flights" },
  openGraph: { type: "website", siteName: "Yallaway", title: "Flight search", description: DESCRIPTION },
};

type Paginated<T> = { items: T[]; totalPages: number };

/** The search, or the backend's 400 message for criteria it rejects (e.g. an airport not in the list). */
async function search(query: string): Promise<{ result?: FlightSearchResult; error?: string }> {
  const res = await backendFetch(`/api/flights/search?${query}`);
  if (res.ok) return { result: (await res.json()) as FlightSearchResult };
  if (res.status === 400) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    return { error: Array.isArray(body.message) ? body.message.join(" ") : body.message };
  }
  throw new Error(`GET /api/flights/search failed with ${res.status}`);
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { criteria, initial, filters, sort, page } = parseFlightSearch(await searchParams);
  const [user, airports, found] = await Promise.all([
    getSessionUser(),
    allPages((p) => backendJson<Paginated<Airport>>(`/api/airports?page=${p}`)),
    criteria ? search(searchQuery(criteria, filters, sort, page)) : Promise.resolve(undefined),
  ]);
  const unread = user ? await getUnreadCount() : 0;
  const result = found?.result;
  const firstCabin = result && ("outbound" in result ? result.outbound.items[0] : result.items[0])?.cabins[0];
  const state = { initial, filters, sort };

  return (
    <PublicShell user={user} unreadNotifications={unread}>
      <PageHeader title="Flight search" description={DESCRIPTION} />
      <div className="grid gap-8">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <FlightSearchBox key={JSON.stringify(initial)} airports={airports} {...state} />
        </div>
        {criteria && (
          <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
            <aside>
              <FlightFilters key={JSON.stringify(filters)} {...state} currency={firstCabin?.currency ?? ""} />
            </aside>
            <section aria-label="Search results">
              {found?.error !== undefined || !result ? (
                <ErrorState title="We couldn't search these flights" message={found?.error} />
              ) : (
                <FlightResults criteria={criteria} {...state} result={result} />
              )}
            </section>
          </div>
        )}
      </div>
    </PublicShell>
  );
}
