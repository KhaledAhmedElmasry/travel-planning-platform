// P-43 Rooms: /hotel/rooms
// Part: T6 Hotel dashboard
// Requirements: HTL-03, HTL-05, HTL-06
// Endpoints: POST /api/hotels/{id}/rooms; PATCH, DELETE /api/hotels/{id}/rooms/{roomId}; GET /api/hotels/{id}/rooms
// Rendering: Dynamic SSR + Client Components. Source: .md section 9 "Admin / Moderator Dashboards"; Client Components for the interactive form, as section 9 says "where browser-side interactivity is required".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-43). Use a shell and kit components (frontend/README.md).
// Built (27 Nov): the server page reads the rooms (10 per page, ?page=N, GEN-05) and the Client Component
// RoomsManager adds, edits, deactivates and deletes them (confirm dialogs, backend errors shown). Loading skeleton, empty state.
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PaginationBar } from "@/components/app/pagination-bar";
import type { HotelRoom } from "@/components/app/hotel-dashboard/room-form";
import { RoomsManager } from "@/components/app/hotel-dashboard/rooms-manager";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Rooms", robots: { index: false } };

type RoomPage = { items: HotelRoom[]; page: number; pageSize: number; total: number; totalPages: number };

async function RoomsData({ hotelId, page }: { hotelId: string; page: number }) {
  const data = await backendJson<RoomPage>(`/api/hotels/${encodeURIComponent(hotelId)}/rooms?page=${page}`);
  if (!data) throw new Error("Could not load the rooms of your hotel");

  if (data.total > 0 && data.items.length === 0) {
    return (
      <EmptyState
        title="That page doesn't exist"
        description="There are no rooms on this page."
        action={
          <Button asChild variant="secondary">
            <Link href="/hotel/rooms">Go to the first page</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-4">
      <RoomsManager hotelId={hotelId} rooms={data.items} />
      {data.total > 0 && (
        <PaginationBar
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          pageSize={data.pageSize}
          hrefFor={(p) => `/hotel/rooms?page=${p}`}
        />
      )}
    </div>
  );
}

function RoomsSkeleton() {
  return (
    <div className="grid gap-3" role="status" aria-label="Loading rooms">
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
      <PageHeader title="Rooms" description="Add rooms, change their price and beds, and take them out of service." />
      <Suspense key={page} fallback={<RoomsSkeleton />}>
        <RoomsData hotelId={user.hotelId} page={page} />
      </Suspense>
    </DashboardShell>
  );
}
