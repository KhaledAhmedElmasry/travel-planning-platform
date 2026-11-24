// P-17 Booking confirmed: /checkout/[type]/[bookingId]/done
// Part: Lead (foundation)
// Requirements: FLT-23, HTL-17
// Endpoints: GET /api/flight-bookings/{id}; GET /api/flight-bookings/{id}/e-ticket; GET /api/hotel-bookings/{id}
// Rendering: Dynamic SSR. Not in .md section 9, decided by the team leader (23 Nov): per-user data read with the session cookie on every request, so it can't be cached for everyone (the booking reference); closest .md section 9 row: "User Booking Pages".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-17). Use a shell and kit components (frontend/README.md).
// The booking is read with the visitor's session: another user's booking answers 404 (ACC-11).
// A booking that is not confirmed yet goes back to the payment page (P-16), which shows its state.
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  ConfirmationPanel,
  type ConfirmedFlightBooking,
  type ConfirmedHotelBooking,
} from "@/components/app/checkout/confirmation-panel";
import { AppShell } from "@/components/layout/app-shell";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Booking confirmed", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ type: string; bookingId: string }> }) {
  const { type, bookingId } = await params;
  if (type !== "flight" && type !== "hotel") notFound();
  const user = await requireUser(["user"]);
  const booking = await backendJson<ConfirmedFlightBooking | ConfirmedHotelBooking>(
    `/api/${type}-bookings/${encodeURIComponent(bookingId)}`,
  );
  if (!booking) notFound();
  if (booking.status !== "confirmed") redirect(`/checkout/${type}/${bookingId}`);

  return (
    <AppShell user={user} unreadNotifications={await getUnreadCount()}>
      <div className="max-w-2xl">
        {type === "flight" ? (
          <ConfirmationPanel kind="flight" booking={booking as ConfirmedFlightBooking} />
        ) : (
          <ConfirmationPanel kind="hotel" booking={booking as ConfirmedHotelBooking} />
        )}
      </div>
    </AppShell>
  );
}
