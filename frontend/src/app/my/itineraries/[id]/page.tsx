// P-25, P-26 Itinerary editor: /my/itineraries/[id]
// Part: T3 Itinerary editor
// Requirements: ITN-01, ITN-05, ITN-07, ITN-08, ITN-09, ITN-10, ITN-12, ITN-14, ITN-16, ITN-18, ITN-20, ITN-25, ITN-26, ITN-27, ITN-28, GEN-12, FLT-02
// Endpoints: GET /api/flights/search; GET, PATCH, DELETE /api/itineraries/{id}; POST /api/itineraries/{id}/days; PATCH, DELETE /api/itineraries/{id}/days/{dayId}; PATCH /api/itineraries/{id}/days/reorder; POST /api/itineraries/{id}/days/{dayId}/activities; PATCH, DELETE /api/activities/{id}; POST /api/activities/{id}/images; DELETE /api/activities/{id}/images/{imageId}; POST /api/itineraries/{id}/days/{dayId}/budgets; PATCH, DELETE /api/budgets/{id}; POST /api/itineraries/{id}/transport-costs; PATCH, DELETE /api/transport-costs/{id}; GET /api/itineraries/{id}/budget-summary; GET /api/itineraries/{id}/hotels; GET /api/itineraries/{id}/flights; POST /api/itineraries/{id}/bookings; DELETE /api/itineraries/{id}/bookings/{linkId}; GET /api/flight-bookings?group=upcoming|past; GET /api/hotel-bookings?group=upcoming|past; GET /api/itineraries/{id}/pdf; GET /api/currencies; GET /api/cities
// Rendering: Dynamic SSR + Client Components. Source: .md section 9 "Private Itinerary Detail" and Source: .md section 9 "Itinerary Editor".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-25, P-26). Use a shell and kit components (frontend/README.md).
// GET /api/countries supplies the predefined list for editing trip countries (ITN-01, GEN-12).
// GET /api/airports supplies the airport options for itinerary flight search (FLT-02).
// GET /api/itineraries/public/{id} supplies public clone attribution (ITN-21).
import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BudgetCurrency, BudgetSummary, type Summary } from "@/components/app/itineraries/budget-summary";
import type { CityGroup } from "@/components/app/itineraries/city-group-header";
import type { Day } from "@/components/app/itineraries/day-card";
import { ExportPdfButton } from "@/components/app/itineraries/export-pdf-button";
import { FindFlightsPanel } from "@/components/app/itineraries/find-flights-panel";
import type { LinkedBooking } from "@/components/app/itineraries/link-booking-dialog";
import type { Transport } from "@/components/app/itineraries/transport-row";
import { PageHeader } from "@/components/app/page-header";
import type { Airport } from "@/components/app/search/flight-search-form";
import { StatusBadge } from "@/components/app/status-badge";
import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { allPages } from "@/lib/all-pages";
import { formatDay } from "@/lib/dates";
import { backendFetch, backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";
import { ItineraryActions, ItineraryLoadError, type Itinerary } from "./itinerary-actions";
import { ItineraryDays } from "./itinerary-days";

export const metadata: Metadata = { title: "Itinerary editor", robots: { index: false } };

type Details = Itinerary & {
  days: Day[];
  cityGroups: CityGroup[];
  transportCosts: Transport[];
  linkedBookings?: LinkedBooking[];
  originalItineraryId?: string | null;
  hidden?: boolean;
  cloneAttribution?: { title: string; authorName: string };
};
type Original = { title: string; author: { name: string } };
type Reference = { code: string; name: string };
type City = { cityId: string; name: string };

function referenceList<T>(path: string) {
  return allPages(async (page) => {
    const result = await backendJson<{ items: T[]; totalPages: number }>(`${path}?page=${page}`);
    if (!result) throw new Error("Could not load reference data");
    return result;
  });
}

async function ItineraryDetails({ id, dayPage, budgetCurrency }: { id: string; dayPage: number; budgetCurrency?: string }) {
  const path = `/api/itineraries/${encodeURIComponent(id)}`;
  const response = await backendFetch(path).catch(() => null);
  if (response?.status === 400 || response?.status === 404) notFound();
  if (!response?.ok) return <ItineraryLoadError />;

  const itinerary = (await response.json()) as Details;
  const [countryList, cityList, currencyList, budget, original, airportList] = await Promise.allSettled([
    referenceList<Reference>("/api/countries"),
    referenceList<City>("/api/cities"),
    referenceList<Reference>("/api/currencies"),
    backendJson<Summary>(`${path}/budget-summary${budgetCurrency ? `?currency=${budgetCurrency}` : ""}`),
    itinerary.originalItineraryId && !itinerary.cloneAttribution
      ? backendJson<Original>(`/api/itineraries/public/${encodeURIComponent(itinerary.originalItineraryId)}`)
      : null,
    referenceList<Airport>("/api/airports"),
  ]);
  const countries = countryList.status === "fulfilled"
    ? countryList.value.map(({ code, name }) => ({ value: code, label: name }))
    : null;
  const cities = cityList.status === "fulfilled"
    ? cityList.value.map(({ cityId, name }) => ({ value: cityId, label: name }))
    : null;
  const currencies = currencyList.status === "fulfilled"
    ? currencyList.value.map(({ code, name }) => ({ value: code, label: `${code} · ${name}` }))
    : null;
  const firstDay = itinerary.days[0];
  const destination = firstDay && {
    id: firstDay.cityId,
    name: cities?.find((city) => city.value === firstDay.cityId)?.label ?? firstDay.cityId,
  };
  const publicOriginal = original.status === "fulfilled" ? original.value : null;
  const attribution = itinerary.cloneAttribution ?? (publicOriginal && {
    title: publicOriginal.title,
    authorName: publicOriginal.author.name,
  });

  return (
    <div className="grid gap-6">
      <PageHeader
        title={itinerary.title}
        description={
          <span className="grid gap-1">
            <span className="flex flex-wrap items-center gap-2">
              {formatDay(itinerary.startDate)}
              {itinerary.hidden && <StatusBadge kind="content" status="hidden" />}
            </span>
            {itinerary.originalItineraryId && (
              <span>{attribution
                ? `Cloned from ${attribution.title} by ${attribution.authorName}`
                : "Cloned from an itinerary that is currently unavailable."}</span>
            )}
          </span>
        }
        back={{ href: "/my/itineraries", label: "My itineraries" }}
        actions={<ExportPdfButton itineraryId={itinerary.id} />}
      />
      {countries?.length
        ? <ItineraryActions itinerary={itinerary} countries={countries} />
        : <ItineraryLoadError title="Could not load countries" />}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          {cities?.length && currencies?.length ? (
            <ItineraryDays id={itinerary.id} days={itinerary.days} groups={itinerary.cityGroups}
              cities={cities} currencies={currencies} transport={itinerary.transportCosts}
              bookings={itinerary.linkedBookings ?? []} requestedPage={dayPage} />
          ) : <ItineraryLoadError title="Could not load cities and currencies" />}
        </div>
        <aside aria-label="Itinerary budget" className="grid min-w-0 gap-4">
          {currencies?.length ? <BudgetCurrency currencies={currencies} value={budgetCurrency} /> : null}
          {budget.status === "fulfilled" && budget.value
            ? <BudgetSummary summary={budget.value} />
            : <ItineraryLoadError title="Could not load the budget summary" />}
        </aside>
      </div>
      {airportList.status === "fulfilled"
        ? <FindFlightsPanel key={`${destination?.id}-${itinerary.startDate}-${itinerary.days.at(-1)?.date}`}
            itineraryId={itinerary.id} airports={airportList.value} city={destination}
            departure={itinerary.startDate} lastDay={itinerary.days.at(-1)?.date} />
        : <ItineraryLoadError title="Could not load airports" />}
    </div>
  );
}

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dayPage?: string | string[]; currency?: string | string[] }>;
}) {
  const user = await requireUser(["user"]);
  const [{ id }, { dayPage, currency }, unreadNotifications] = await Promise.all([params, searchParams, getUnreadCount()]);
  const requestedPage = typeof dayPage === "string" && /^[1-9]\d*$/.test(dayPage) ? Number(dayPage) : 1;
  const budgetCurrency = typeof currency === "string" && /^[A-Z]{3}$/.test(currency) ? currency : undefined;

  return (
    <AppShell user={user} unreadNotifications={unreadNotifications}>
      <Suspense fallback={<Skeleton className="h-64 w-full" aria-label="Loading itinerary" />}>
        <ItineraryDetails id={id} dayPage={requestedPage} budgetCurrency={budgetCurrency} />
      </Suspense>
    </AppShell>
  );
}
