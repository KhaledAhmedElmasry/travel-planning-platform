// P-21 Flight booking details: /bookings/flights/[id]
// Part: Lead (foundation)
// Requirements: FLT-25, FLT-26, PAY-03, FLT-27 (Bonus), FLT-28 (Bonus)
// Endpoints: GET /api/flight-bookings/{id}; POST /api/flight-bookings/{id}/cancel; PATCH /api/flight-bookings/{id}/change-flight; GET /api/flight-bookings/{id}/e-ticket; PATCH /api/flight-bookings/{id}/seat; GET /api/flight-bookings/{id}/seats; GET /api/flights/search (change flight); GET /api/refunds/{id}
// Rendering: Dynamic SSR. Source: .md section 9 "User Booking Pages"; cancel / change-flight / seat dialogs are Client Components.
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-21). Use a shell and kit components (frontend/README.md).
// The booking is read with the visitor's session: another user's booking answers 404 (ACC-11).
// The details already carry the refund (PAY-03) and the cancellation preview, so GET /api/refunds/{id}
// is not needed here; after a cancel the page is re-rendered (router.refresh()).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";
import { FlightBookingDetails, type FlightBookingDetailsData } from "@/components/app/bookings/flight-booking-details";
import type { SeatMapData } from "@/components/app/bookings/seat-map";

export const metadata: Metadata = { title: "Flight booking", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["user"]);
  const [booking, unread] = await Promise.all([
    backendJson<FlightBookingDetailsData>(`/api/flight-bookings/${encodeURIComponent(id)}`),
    getUnreadCount(),
  ]);
  if (!booking) notFound();
  // FLT-28 seat map (backend PR #289): only a Confirmed booking can choose seats.
  const seatMap =
    booking.status === "confirmed"
      ? await backendJson<SeatMapData>(`/api/flight-bookings/${encodeURIComponent(id)}/seats`)
      : null;

  return (
    <AppShell user={user} unreadNotifications={unread}>
      <div className="max-w-3xl">
        <PageHeader title="Flight booking" back={{ href: "/bookings?type=flights&tab=upcoming", label: "My bookings" }} />
        <FlightBookingDetails booking={booking} seatMap={seatMap} />
      </div>
    </AppShell>
  );
}
