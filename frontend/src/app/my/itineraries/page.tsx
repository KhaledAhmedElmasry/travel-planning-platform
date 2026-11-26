// P-24 My itineraries: /my/itineraries
// Part: T1 Flights + itinerary list
// Requirements: ITN-03
// Endpoints: GET /api/itineraries; GET /api/countries (country names for ItineraryCard)
// Rendering: Dynamic SSR. Not in .md section 9, decided by the team leader (23 Nov): per-user data read with the session cookie on every request, so it can't be cached for everyone (private itineraries); same reason as .md section 9 "Private Itinerary Detail".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-24). Use a shell and kit components (frontend/README.md).
// Built: the user's own itineraries, most recently updated first (the backend's order), as ItineraryCard
// with title, countries (full names), start date, number of days and Private / Public (ITN-03), each
// linking to P-26; 10 per page (?page=, GEN-05); "New itinerary" to P-25; the empty state (GEN-04).
// Registered users only: requireUser(["user"]) sends a guest to log in and back.
import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PaginationBar } from "@/components/app/pagination-bar";
import { ItineraryCard, type ItinerarySummary } from "@/components/app/shared/itinerary-card";
import type { Country } from "@/components/app/search/hotel-search-form";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { allPages } from "@/lib/all-pages";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "My itineraries", robots: { index: false } };

type ItineraryPage = { items: ItinerarySummary[]; page: number; pageSize: number; total: number; totalPages: number };
type SearchParams = Promise<{ page?: string | string[] }>;

const NEW_HREF = "/my/itineraries/new";

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser(["user"]);
  const raw = Number((await searchParams).page);
  const page = Number.isInteger(raw) && raw > 0 ? raw : 1;
  const [data, countries, unread] = await Promise.all([
    backendJson<ItineraryPage>(`/api/itineraries?page=${page}`),
    allPages((p) => backendJson<{ items: Country[]; totalPages: number }>(`/api/countries?page=${p}`)),
    getUnreadCount(),
  ]);
  if (!data) throw new Error("Could not load your itineraries");
  const countryNames = Object.fromEntries(countries.map((c) => [c.code, c.name]));

  const newButton = (
    <Button asChild>
      <Link href={NEW_HREF}>
        <PlusIcon aria-hidden="true" />
        New itinerary
      </Link>
    </Button>
  );

  return (
    <AppShell user={user} unreadNotifications={unread}>
      <PageHeader title="My itineraries" description="Your trips, private or public." actions={data.total > 0 ? newButton : undefined} />
      {data.total === 0 ? (
        // GEN-04: the handout's empty state for My itineraries (So3ad, "So empty! Let's plan something.").
        <EmptyState title="No trips yet" line="So empty! Let's plan something." action={newButton} />
      ) : data.items.length === 0 ? (
        // A page number past the last page (e.g. after deleting the last itinerary of a page).
        <EmptyState
          title="This page is empty"
          action={
            <Button asChild>
              <Link href="/my/itineraries">Go to page 1</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6">
          <ul className="grid gap-4 md:grid-cols-2">
            {data.items.map((itinerary) => (
              <li key={itinerary.id}>
                <ItineraryCard itinerary={itinerary} countryNames={countryNames} href={`/my/itineraries/${itinerary.id}`} showVisibility />
              </li>
            ))}
          </ul>
          <PaginationBar
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            pageSize={data.pageSize}
            hrefFor={(p) => (p > 1 ? `/my/itineraries?page=${p}` : "/my/itineraries")}
          />
        </div>
      )}
    </AppShell>
  );
}
