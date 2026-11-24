// P-23 Hotel reservation details: /bookings/hotels/[id]
// Part: Lead (foundation)
// Requirements: HTL-20, HTL-21, HTL-23, PAY-03
// Endpoints: GET /api/hotel-bookings/{id}; POST /api/hotel-bookings/{id}/cancel; POST /api/hotel-bookings/{id}/review; PATCH, DELETE /api/reviews/{id}; GET /api/refunds/{id}
// Rendering: Dynamic SSR. Source: .md section 9 "User Booking Pages"; cancel and review dialogs are Client Components.
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-23). Use a shell and kit components (frontend/README.md).
// The reservation is read with the visitor's session: another user's reservation answers 404 (ACC-11).
// The details already carry the refund (PAY-03) and the cancellation preview, so GET /api/refunds/{id}
// is not needed here; after a cancel the page is re-rendered (router.refresh()).
// TODO(L2): review section (HTL-23) after ReviewCard/StarRating merge
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";
import { HotelBookingDetails, type HotelBookingDetailsData } from "@/components/app/bookings/hotel-booking-details";

export const metadata: Metadata = { title: "Hotel reservation", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["user"]);
  const [booking, unread] = await Promise.all([
    backendJson<HotelBookingDetailsData>(`/api/hotel-bookings/${encodeURIComponent(id)}`),
    getUnreadCount(),
  ]);
  if (!booking) notFound();

  return (
    <AppShell user={user} unreadNotifications={unread}>
      <div className="max-w-3xl">
        <PageHeader title="Hotel reservation" back={{ href: "/bookings?type=hotels&tab=upcoming", label: "My bookings" }} />
        <HotelBookingDetails booking={booking} />
      </div>
    </AppShell>
  );
}
