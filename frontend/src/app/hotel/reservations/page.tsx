// P-47 Reservations: /hotel/reservations
// Part: T6 Hotel dashboard
// Requirements: HTL-22
// Endpoints: GET /api/hotels/{id}/reservations
// Rendering: Dynamic SSR. Source: .md section 9 "Admin / Moderator Dashboards".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-47). Use a shell and kit components (frontend/README.md).
// Built (27 Nov): paginated table (GEN-05, ?page=N) of reference, guest, rooms, dates and status;
// loading skeleton while the list streams in, empty state (GEN-04), error page if the backend fails.
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PaginationBar } from "@/components/app/pagination-bar";
import { StatusBadge } from "@/components/app/status-badge";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDay } from "@/lib/dates";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";
import type { Reservation } from "../hotel-overview";

export const metadata: Metadata = { title: "Reservations", robots: { index: false } };

type ReservationPage = {
  items: Reservation[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

async function ReservationsList({ hotelId, page }: { hotelId: string; page: number }) {
  const data = await backendJson<ReservationPage>(
    `/api/hotels/${encodeURIComponent(hotelId)}/reservations?page=${page}`,
  );
  if (!data) throw new Error("Could not load the reservations of your hotel");

  if (data.total === 0) {
    return (
      <EmptyState
        title="No reservations yet"
        line="So quiet! Guests will show up here."
        description="Reservations for your hotel appear here once guests book a room."
      />
    );
  }

  // ?page=99 on a list with fewer pages: say so and offer the way back (GEN-04, GEN-14).
  if (data.items.length === 0) {
    return (
      <EmptyState
        title="That page doesn't exist"
        description="There are no reservations on this page."
        action={
          <Button asChild variant="secondary">
            <Link href="/hotel/reservations">Go to the first page</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-4">
      <DataTable
        caption="Reservations of your hotel"
        rows={data.items}
        rowKey={(reservation) => reservation.id}
        columns={[
          { header: "Reference", cell: (r) => <span className="font-semibold">{r.reference ?? "-"}</span> },
          { header: "Guest", cell: (r) => r.guest.name },
          {
            header: "Rooms",
            cell: (r) => r.rooms.map((room) => `Room ${room.roomNumber}`).join(", "),
            hideOnMobile: true,
          },
          { header: "Check-in", cell: (r) => formatDay(r.checkIn) },
          { header: "Check-out", cell: (r) => formatDay(r.checkOut) },
          { header: "Status", cell: (r) => <StatusBadge kind="booking" status={r.status} /> },
        ]}
      />
      <PaginationBar
        page={data.page}
        totalPages={data.totalPages}
        total={data.total}
        pageSize={data.pageSize}
        hrefFor={(p) => `/hotel/reservations?page=${p}`}
      />
    </div>
  );
}

function ReservationsSkeleton() {
  return (
    <div className="grid gap-3" role="status" aria-label="Loading reservations">
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const user = await requireUser(["hotel_moderator"]);
  if (!user.hotelId) throw new Error("This moderator account has no hotel");
  const raw = Number((await searchParams).page);
  const page = Number.isInteger(raw) && raw > 0 ? raw : 1;
  const unread = await getUnreadCount();

  return (
    <DashboardShell user={user} unreadNotifications={unread}>
      <PageHeader title="Reservations" description="Everyone who has booked a room in your hotel." />
      <Suspense key={page} fallback={<ReservationsSkeleton />}>
        <ReservationsList hotelId={user.hotelId} page={page} />
      </Suspense>
    </DashboardShell>
  );
}
