// - Home (registered user): /home
// Part: Lead (foundation)
// Requirements: ACC-04 (role home)
// Endpoints: GET /api/flight-bookings?group=upcoming; GET /api/hotel-bookings?group=upcoming; GET /api/airports; GET /api/countries; GET /api/cities
// Rendering: Dynamic SSR. Not in .md section 9, decided by the team leader (23 Nov): per-user data read with the session cookie on every request, so it can't be cached for everyone (upcoming trips).
// Spec: MILESTONE2_FRONTEND_SPEC.md section 2, Registered User row: upcoming trips, quick flight/hotel
// search, My itineraries shortcut. Team leader (24 Nov): no notifications block (the header bell covers it).
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import type { Airport } from "@/components/app/search/flight-search-form";
import type { City, Country } from "@/components/app/search/hotel-search-form";
import { AppShell } from "@/components/layout/app-shell";
import { allPages } from "@/lib/all-pages";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";
import { HomeSearch } from "../home-search";
import { ItinerariesShortcut, UpcomingTrips, type UpcomingFlight, type UpcomingHotel } from "./upcoming-trips";

export const metadata: Metadata = { title: "Home", robots: { index: false } };

type Page<T> = { items: T[]; totalPages: number };
const list = <T,>(path: string) => allPages((page) => backendJson<Page<T>>(`${path}?page=${page}`));

export default async function Page() {
  const user = await requireUser(["user"]);
  const [flights, hotels, airports, countries, cities, unread] = await Promise.all([
    backendJson<Page<UpcomingFlight>>("/api/flight-bookings?group=upcoming"),
    backendJson<Page<UpcomingHotel>>("/api/hotel-bookings?group=upcoming"),
    list<Airport>("/api/airports"),
    list<Country>("/api/countries"),
    list<City>("/api/cities"),
    getUnreadCount(),
  ]);

  return (
    <AppShell user={user} unreadNotifications={unread}>
      <PageHeader title="Home" />
      <div className="grid gap-10">
        <HomeSearch airports={airports} countries={countries} cities={cities} />
        <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
          <UpcomingTrips flights={flights?.items ?? []} hotels={hotels?.items ?? []} />
          <ItinerariesShortcut />
        </div>
      </div>
    </AppShell>
  );
}
