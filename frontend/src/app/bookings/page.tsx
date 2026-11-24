// P-20, P-22 My bookings: /bookings
// Part: Lead (foundation)
// Requirements: FLT-25, HTL-20
// Endpoints: POST, GET /api/flight-bookings; POST, GET /api/hotel-bookings
// Rendering: Dynamic SSR. Source: .md section 9 "User Booking Pages".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-20, P-22). Use a shell and kit components (frontend/README.md).
// Layout (team leader, 24 Nov): Flights | Hotels switch, then Upcoming / Past / Cancelled
// (GET /api/flight-bookings?group= or GET /api/hotel-bookings?group=), one list at a time.
// The list is read with the visitor's session, so only their own bookings come back (ACC-11).
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";
import type { FlightBookingListItem, HotelBookingListItem } from "@/components/app/bookings/booking-list-item";
import { MyBookingsView, parseBookingsQuery, type Paginated } from "./my-bookings-view";

export const metadata: Metadata = { title: "My bookings", robots: { index: false } };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser(["user"]);
  const { type, tab, page } = parseBookingsQuery(await searchParams);
  const path = type === "flights" ? "flight-bookings" : "hotel-bookings";
  const [list, unread] = await Promise.all([
    backendJson<Paginated<FlightBookingListItem & HotelBookingListItem>>(`/api/${path}?group=${tab}&page=${page}`),
    getUnreadCount(),
  ]);
  if (!list) throw new Error("Could not load your bookings");

  return (
    <AppShell user={user} unreadNotifications={unread}>
      <PageHeader title="My bookings" />
      {type === "flights" ? (
        <MyBookingsView type="flights" tab={tab} list={list} />
      ) : (
        <MyBookingsView type="hotels" tab={tab} list={list} />
      )}
    </AppShell>
  );
}
