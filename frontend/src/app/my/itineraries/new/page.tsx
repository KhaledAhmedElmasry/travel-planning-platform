// P-25 New itinerary: /my/itineraries/new
// Part: T3 Itinerary editor
// Requirements: ITN-01, ITN-20, GEN-12
// Endpoints: POST /api/itineraries; GET /api/countries
// PATCH /api/itineraries/{id} publishes a new itinerary when Public is selected.
// Rendering: Dynamic SSR + Client Components. Source: .md section 9 "Itinerary Editor".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-25). Use a shell and kit components (frontend/README.md).
import { Suspense } from "react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { allPages } from "@/lib/all-pages";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";
import { CountryLoadError, NewItineraryForm } from "./new-itinerary-form";

export const metadata: Metadata = { title: "New itinerary", robots: { index: false } };

type Country = { code: string; name: string };
type CountryPage = { items: Country[]; totalPages: number };

async function CreateForm() {
  const countries = await allPages(async (page) => {
    const result = await backendJson<CountryPage>(`/api/countries?page=${page}`);
    if (!result) throw new Error("Could not load countries");
    return result;
  }).catch(() => null);
  if (!countries) return <CountryLoadError />;
  if (countries.length === 0) return <EmptyState title="No countries available" />;

  return (
    <NewItineraryForm
      countries={countries.map(({ code, name }) => ({ value: code, label: name }))}
    />
  );
}

export default async function Page() {
  const user = await requireUser(["user"]);
  const unreadNotifications = await getUnreadCount();

  return (
    <AppShell user={user} unreadNotifications={unreadNotifications}>
      <div className="grid max-w-xl gap-6">
        <PageHeader title="New itinerary" back={{ href: "/my/itineraries", label: "My itineraries" }} />
        <Suspense fallback={<Skeleton className="h-64 w-full" aria-label="Loading countries" />}>
          <CreateForm />
        </Suspense>
      </div>
    </AppShell>
  );
}
