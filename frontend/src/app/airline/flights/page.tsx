// P-36 Flights: /airline/flights
// Part: T5 Airline dashboard
// Requirements: FLT-30
// Endpoints: GET /api/airlines/{id}/flights
// Rendering: Dynamic SSR. Source: .md section 9 "Admin / Moderator Dashboards".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-36). Use a shell and kit components (frontend/README.md).
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { ErrorState } from "@/components/app/error-state";
import { FormField } from "@/components/app/form-field";
import { LocalTime } from "@/components/app/local-time";
import { PageHeader } from "@/components/app/page-header";
import { PaginationBar } from "@/components/app/pagination-bar";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Flights", robots: { index: false } };

type FlightStatus = "scheduled" | "cancelled" | "departed";

type AirlineFlight = {
  id: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTimeZone: string;
  arrivalTimeZone: string;
  departureAt: string;
  arrivalAt: string;
  status: FlightStatus;
  hasBookings: boolean;
  currency: string;
};

type AirlineFlightList = {
  items: AirlineFlight[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

type FlightFilters = {
  page: number;
  status?: FlightStatus;
  from?: string;
  to?: string;
};

const FLIGHT_STATUSES = ["scheduled", "cancelled", "departed"] as const;

function singleValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parseFilters(searchParams: SearchParams): { filters?: FlightFilters; error?: string } {
  const rawPage = singleValue(searchParams.page);
  const rawStatus = singleValue(searchParams.status) || undefined;
  const from = singleValue(searchParams.from) || undefined;
  const to = singleValue(searchParams.to) || undefined;
  const page = rawPage ? Number(rawPage) : 1;

  if (searchParams.page !== undefined && (rawPage === undefined || !/^\d+$/.test(rawPage) || !Number.isSafeInteger(page) || page < 1)) {
    return { error: "Page must be a whole number greater than or equal to 1." };
  }
  if (Array.isArray(searchParams.status) || (rawStatus !== undefined && rawStatus !== "all" && !FLIGHT_STATUSES.includes(rawStatus as FlightStatus))) {
    return { error: "Choose Scheduled, Cancelled, or Departed for the status filter." };
  }
  if (Array.isArray(searchParams.from) || (from !== undefined && !validDate(from))) {
    return { error: "Enter a valid start date in YYYY-MM-DD format." };
  }
  if (Array.isArray(searchParams.to) || (to !== undefined && !validDate(to))) {
    return { error: "Enter a valid end date in YYYY-MM-DD format." };
  }

  return {
    filters: {
      page,
      ...(rawStatus && rawStatus !== "all" ? { status: rawStatus as FlightStatus } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    },
  };
}

function queryString(filters: Omit<FlightFilters, "page"> & { page?: number }): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

function FlightsLoading() {
  return (
    <div className="grid gap-3" aria-label="Loading flights" role="status">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

function FlightLoadError({ message, href }: { message: string; href: string }) {
  return (
    <>
      <ErrorState message={message} />
      <div className="mt-2 flex justify-center">
        <Button asChild variant="outline">
          <Link href={href}>Try again</Link>
        </Button>
      </div>
    </>
  );
}

async function FlightsTable({ airlineId, filters }: { airlineId: string; filters: FlightFilters }) {
  const query = new URLSearchParams({ page: String(filters.page) });
  if (filters.status) query.set("status", filters.status);
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);

  let data: AirlineFlightList | null;
  try {
    data = await backendJson<AirlineFlightList>(
      `/api/airlines/${encodeURIComponent(airlineId)}/flights?${query.toString()}`,
    );
  } catch {
    return (
      <FlightLoadError
        message="We couldn't load your airline's flights. Check your connection and try again."
        href={`/airline/flights${queryString(filters)}`}
      />
    );
  }

  if (!data) {
    return (
      <FlightLoadError
        message="We couldn't load your airline's flights. Refresh the page or try again later."
        href={`/airline/flights${queryString(filters)}`}
      />
    );
  }

  return (
    <>
      <DataTable
        caption="Airline flights"
        rows={data.items}
        rowKey={(flight) => flight.id}
        empty={
          <EmptyState
            title="No flights found"
            line="There are no flights matching these filters."
            description="Change or clear the filters to see other flights."
            compact
          />
        }
        columns={[
          { header: "Flight number", cell: (flight) => <span className="font-semibold">{flight.flightNumber}</span> },
          {
            header: "Route",
            cell: (flight) => (
              <span className="whitespace-nowrap">
                {flight.departureAirport} <span aria-hidden="true">→</span> {flight.arrivalAirport}
              </span>
            ),
          },
          {
            header: "Departure",
            cell: (flight) => (
              <LocalTime
                iso={flight.departureAt}
                timeZone={flight.departureTimeZone}
                airport={flight.departureAirport}
                showDate
                size="sm"
              />
            ),
          },
          {
            header: "Arrival",
            cell: (flight) => (
              <LocalTime
                iso={flight.arrivalAt}
                timeZone={flight.arrivalTimeZone}
                airport={flight.arrivalAirport}
                showDate
                size="sm"
              />
            ),
          },
          {
            header: "Status",
            cell: (flight) => <StatusBadge kind="flight" status={flight.status} />,
          },
          {
            header: "Actions",
            cell: (flight) => (
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <Link className="text-sm font-medium text-link hover:underline" href={`/airline/flights/${encodeURIComponent(flight.id)}`}>
                  Manage flight
                </Link>
                <Link className="text-sm font-medium text-link hover:underline" href={`/airline/flights/${encodeURIComponent(flight.id)}/bookings`}>
                  View bookings
                </Link>
              </div>
            ),
          },
        ]}
      />
      <PaginationBar
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        totalPages={data.totalPages}
        hrefFor={(page) => `/airline/flights${queryString({ ...filters, page })}`}
        className="mt-4"
      />
    </>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser(["airline_moderator"]);
  const [unread, params] = await Promise.all([getUnreadCount(), searchParams]);
  const parsed = parseFilters(params);
  const airlineId = user.airlineId;

  return (
    <DashboardShell user={user} unreadNotifications={unread}>
      <PageHeader title="Flights" description="Review your airline's flights, departure and arrival times, and status." />
      <form action="/airline/flights" method="get" className="mb-6 grid items-end gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <FormField label="Status" name="status">
          <Select defaultValue={parsed.filters?.status ?? "all"}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="departed">Departed</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Departure from" name="from" error={parsed.error?.includes("start date") ? parsed.error : undefined}>
          <Input type="date" defaultValue={singleValue(params.from)} />
        </FormField>
        <FormField label="Departure to" name="to" error={parsed.error?.includes("end date") ? parsed.error : undefined}>
          <Input type="date" defaultValue={singleValue(params.to)} />
        </FormField>
        <div className="flex flex-wrap gap-2 lg:col-span-2">
          <Button type="submit" className="w-full sm:w-auto">Apply filters</Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/airline/flights">Clear filters</Link>
          </Button>
        </div>
      </form>

      {!airlineId ? (
        <ErrorState message="This airline moderator account is not linked to an airline. Contact your administrator to correct the account." />
      ) : parsed.error ? (
        <ErrorState message={parsed.error} />
      ) : (
        <Suspense fallback={<FlightsLoading />}>
          <FlightsTable airlineId={airlineId} filters={parsed.filters!} />
        </Suspense>
      )}
    </DashboardShell>
  );
}
