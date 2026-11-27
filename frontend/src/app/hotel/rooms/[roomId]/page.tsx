// P-44 Room availability: /hotel/rooms/[roomId]
// Part: T6 Hotel dashboard
// Requirements: HTL-04, HTL-05, HTL-06
// Endpoints: POST, PATCH /api/hotels/{id}/rooms/{roomId}/availability; GET /api/hotels/{id}/rooms
// Rendering: Dynamic SSR + Client Components. Source: .md section 9 "Admin / Moderator Dashboards"; Client Components for the interactive form, as section 9 says "where browser-side interactivity is required".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-44). Use a shell and kit components (frontend/README.md).
// Built (27 Nov): the server page finds the room in GET /api/hotels/{id}/rooms (all pages; there is no single-room GET,
// spec section 8) and shows its bookable and blocked ranges; the Client Component AvailabilityRangesEditor adds, removes,
// blocks and unblocks dates. A room that is not in this hotel shows the not-found page. Loading skeleton.
import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { AvailabilityRangesEditor, type RoomWithRanges } from "@/components/app/hotel-dashboard/availability-ranges-editor";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { allPages } from "@/lib/all-pages";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Room availability", robots: { index: false } };

type RoomPage = { items: RoomWithRanges[]; totalPages: number };

async function RoomAvailability({ hotelId, roomId }: { hotelId: string; roomId: string }) {
  const hotel = `/api/hotels/${encodeURIComponent(hotelId)}`;
  const rooms = await allPages((page) => backendJson<RoomPage>(`${hotel}/rooms?page=${page}`));
  const room = rooms.find((item) => item.id === roomId);
  if (!room) notFound();

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Room ${room.roomNumber}`}
        description={`${room.type}. Choose when guests can book this room and block nights you don't want to sell.`}
        back={{ href: "/hotel/rooms", label: "Rooms" }}
        actions={<StatusBadge kind="provider" status={room.active ? "active" : "inactive"} />}
      />
      <AvailabilityRangesEditor hotelId={hotelId} room={room} />
    </div>
  );
}

function RoomAvailabilitySkeleton() {
  return (
    <div className="grid gap-6" role="status" aria-label="Loading room">
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const user = await requireUser(["hotel_moderator"]);
  if (!user.hotelId) throw new Error("This moderator account has no hotel");
  const { roomId } = await params;
  const unread = await getUnreadCount();

  return (
    <DashboardShell user={user} unreadNotifications={unread}>
      <Suspense key={roomId} fallback={<RoomAvailabilitySkeleton />}>
        <RoomAvailability hotelId={user.hotelId} roomId={roomId} />
      </Suspense>
    </DashboardShell>
  );
}
