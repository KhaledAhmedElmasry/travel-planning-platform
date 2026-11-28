// P-45 Availability calendar: /hotel/availability
// Part: T6 Hotel dashboard
// Requirements: HTL-08
// Endpoints: GET /api/hotels/{id}/availability
// Rendering: Dynamic SSR. Source: .md section 9 "Admin / Moderator Dashboards".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-45). Use a shell and kit components (frontend/README.md).
// Built (27 Nov): choose a date range (?from=&to=, default today + 6 days, at most 366 days); each room shows
// Available, Booked (with reservation reference) or Blocked per date. Rooms paginated (GEN-05, ?page=N),
// loading skeleton, empty state (GEN-04). The range picker is a small Client Component.
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PaginationBar } from "@/components/app/pagination-bar";
import {
  AvailabilityGrid,
  MAX_RANGE_DAYS,
  type RoomAvailabilityRow,
} from "@/components/app/hotel-dashboard/availability-grid";
import { AvailabilityRangeForm } from "@/components/app/hotel-dashboard/availability-range-form";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fromDateString, nightsBetween, toDateString, todayString } from "@/lib/dates";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Availability", robots: { index: false } };

const DEFAULT_DAYS = 7;

type AvailabilityPage = {
  items: RoomAvailabilityRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type Params = { from?: string | string[]; to?: string | string[]; page?: string | string[] };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function isDay(value: string | undefined): value is string {
  const date = fromDateString(value);
  return !!date && toDateString(date) === value;
}

function addDays(day: string, days: number): string {
  const date = fromDateString(day);
  if (!date) return day;
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

// shortcut: "today" is the server's calendar day (same as the hotel overview).
function resolveRange(from?: string, to?: string) {
  if (isDay(from) && isDay(to) && to >= from && nightsBetween(from, to) + 1 <= MAX_RANGE_DAYS) {
    return { from, to };
  }
  const start = todayString();
  return { from: start, to: addDays(start, DEFAULT_DAYS - 1) };
}

async function AvailabilityList({
  hotelId,
  from,
  to,
  page,
}: {
  hotelId: string;
  from: string;
  to: string;
  page: number;
}) {
  const data = await backendJson<AvailabilityPage>(
    `/api/hotels/${encodeURIComponent(hotelId)}/availability?from=${from}&to=${to}&page=${page}`,
  );
  if (!data) throw new Error("Could not load the availability of your hotel");

  if (data.total === 0) {
    return (
      <EmptyState
        title="No rooms yet"
        description="Add rooms to see their availability here."
        action={
          <Button asChild>
            <Link href="/hotel/rooms">Go to rooms</Link>
          </Button>
        }
      />
    );
  }

  if (data.items.length === 0) {
    return (
      <EmptyState
        title="That page doesn't exist"
        description="There are no rooms on this page."
        action={
          <Button asChild variant="secondary">
            <Link href={`/hotel/availability?from=${from}&to=${to}`}>Go to the first page</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-4">
      <AvailabilityGrid rooms={data.items} />
      <PaginationBar
        page={data.page}
        totalPages={data.totalPages}
        total={data.total}
        pageSize={data.pageSize}
        hrefFor={(p) => `/hotel/availability?from=${from}&to=${to}&page=${p}`}
      />
    </div>
  );
}

function AvailabilitySkeleton() {
  return (
    <div className="grid gap-3" role="status" aria-label="Loading availability">
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireUser(["hotel_moderator"]);
  if (!user.hotelId) throw new Error("This moderator account has no hotel");
  const params = await searchParams;
  const { from, to } = resolveRange(first(params.from), first(params.to));
  const rawPage = Number(first(params.page));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const unread = await getUnreadCount();

  return (
    <DashboardShell user={user} unreadNotifications={unread}>
      <div className="grid gap-6">
        <PageHeader
          title="Availability"
          description="See which rooms are available, booked or blocked. Dates outside a room's bookable ranges show as blocked."
        />
        <AvailabilityRangeForm key={`${from}-${to}`} from={from} to={to} />
        <Suspense key={`${from}-${to}-${page}`} fallback={<AvailabilitySkeleton />}>
          <AvailabilityList hotelId={user.hotelId} from={from} to={to} page={page} />
        </Suspense>
      </div>
    </DashboardShell>
  );
}
