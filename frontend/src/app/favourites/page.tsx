// - (Bonus) Favourites: /favourites
// Part: Lead (foundation)
// Requirements: BON-02
// Endpoints: POST, GET /api/favourites; DELETE /api/favourites/{id}; GET /api/countries
// Rendering: Dynamic SSR. Not in .md section 9, decided by the team leader (23 Nov): per-user data read with the session cookie on every request, so it can't be cached for everyone.
// Spec: MILESTONE2_FRONTEND_SPEC.md (page - (Bonus)). Use a shell and kit components (frontend/README.md).
// Built (24 Nov): Hotels | Itineraries tabs (?tab=), 10 per page (?page=), Remove with confirmation
// (team leader decision 24 Nov - favourites). Registered users only (the backend refuses other roles).
// Saving happens on the hotel and itinerary pages (FavouriteButton, POST /api/favourites).
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { AppShell } from "@/components/layout/app-shell";
import type { Country } from "@/components/app/search/hotel-search-form";
import { allPages } from "@/lib/all-pages";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";
import { FavouritesSection, type FavouritePage, type FavouriteTab } from "./favourites-list";

export const metadata: Metadata = { title: "Favourites", robots: { index: false } };

type SearchParams = Promise<{ tab?: string | string[]; page?: string | string[] }>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser(["user"]);
  const params = await searchParams;
  const tab: FavouriteTab = params.tab === "itineraries" ? "itineraries" : "hotels";
  const raw = Number(params.page);
  const page = Number.isInteger(raw) && raw > 0 ? raw : 1;
  const type = tab === "hotels" ? "hotel" : "itinerary";
  const [data, countries, unread] = await Promise.all([
    backendJson<FavouritePage>(`/api/favourites?type=${type}&page=${page}`),
    allPages((p) => backendJson<{ items: Country[]; totalPages: number }>(`/api/countries?page=${p}`)),
    getUnreadCount(),
  ]);
  if (!data) throw new Error("Could not load your favourites");

  return (
    <AppShell user={user} unreadNotifications={unread}>
      <PageHeader title="Favourites" description="Hotels and public itineraries you saved." />
      <FavouritesSection key={`${tab}-${page}`} tab={tab} data={data} countryNames={Object.fromEntries(countries.map((c) => [c.code, c.name]))} />
    </AppShell>
  );
}
