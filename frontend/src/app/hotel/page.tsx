// - Hotel overview: /hotel
// Part: Lead (foundation)
// Requirements: ACC-04 (role home)
// Endpoints: GET /api/hotels/{id}/reservations; GET /api/hotels/{id}/rooms
// Rendering: Dynamic SSR. Source: .md section 9 "Admin / Moderator Dashboards".
// Spec: MILESTONE2_FRONTEND_SPEC.md section 2, Hotel Moderator row. The moderator's hotel is
// `hotelId` from GET /api/auth/me (ACC-13).
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { allPages } from "@/lib/all-pages";
import { todayString } from "@/lib/dates";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";
import { HotelOverview, type Reservation } from "./hotel-overview";

export const metadata: Metadata = { title: "Hotel overview", robots: { index: false } };

type Page<T> = { items: T[]; total: number; totalPages: number };

export default async function Page() {
  const user = await requireUser(["hotel_moderator"]);
  if (!user.hotelId) throw new Error("This moderator account has no hotel");
  const hotel = `/api/hotels/${encodeURIComponent(user.hotelId)}`;
  // shortcut: "today" is the server's calendar day; fine while the server and the hotel share a time zone.
  const date = todayString();
  const [today, rooms, activeRooms, upcoming, confirmed, unread] = await Promise.all([
    allPages((page) =>
      backendJson<Page<Reservation>>(`${hotel}/reservations?status=confirmed&from=${date}&to=${date}&page=${page}`),
    ),
    backendJson<Page<{ id: string }>>(`${hotel}/rooms`),
    allPages((page) => backendJson<Page<{ id: string }>>(`${hotel}/rooms?active=true&page=${page}`)),
    backendJson<Page<Reservation>>(`${hotel}/reservations?from=${date}`),
    allPages((page) => backendJson<Page<Reservation>>(`${hotel}/reservations?status=confirmed&from=${date}&page=${page}`)),
    getUnreadCount(),
  ]);

  return (
    <DashboardShell user={user} unreadNotifications={unread}>
      <PageHeader title="Hotel overview" />
      <HotelOverview
        date={date}
        today={today}
        roomsTotal={rooms?.total ?? 0}
        activeRoomIds={activeRooms.map((room) => room.id)}
        upcoming={upcoming?.items ?? []}
        confirmed={confirmed}
      />
    </DashboardShell>
  );
}
