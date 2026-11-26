// P-16 Payment: /checkout/[type]/[bookingId]
// Part: Lead (foundation)
// Requirements: PAY-01
// Endpoints: GET /api/flight-bookings/{id}; GET /api/hotel-bookings/{id}; POST /api/payments; POST /api/payments/{id}/retry; GET /api/payments/{id}
// Rendering: Dynamic SSR + Client Components. Not in .md section 9, decided by the team leader (23 Nov): per-user data read with the session cookie on every request, so it can't be cached for everyone; Stripe Elements must run in the browser so card data never reaches the backend (PAY-01).
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-16). Use a shell and kit components (frontend/README.md).
// The booking is read with the visitor's session (GET /api/{flight|hotel}-bookings/{id}): another
// user's booking answers 404 (ACC-11). A confirmed booking goes straight to P-17.
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";
import { PaymentClient } from "./payment-client";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

type Booking = { status: string; totalAmount: number; currency: string; holdExpiresAt: string | null };

export default async function Page({ params }: { params: Promise<{ type: string; bookingId: string }> }) {
  const { type, bookingId } = await params;
  if (type !== "flight" && type !== "hotel") notFound();
  const user = await requireUser(["user"]);
  const booking = await backendJson<Booking>(`/api/${type}-bookings/${encodeURIComponent(bookingId)}`);
  if (!booking) notFound();
  if (booking.status === "confirmed") redirect(`/checkout/${type}/${bookingId}/done`);

  return (
    <AppShell user={user} unreadNotifications={await getUnreadCount()}>
      <div className="grid max-w-xl gap-6">
        <PageHeader title="Payment" />
        <PaymentClient
          bookingType={type}
          bookingId={bookingId}
          amount={booking.totalAmount}
          currency={booking.currency}
          // expired / cancelled bookings have no hold left: the panel shows "Search again"
          holdExpiresAt={booking.holdExpiresAt ?? new Date(0).toISOString()}
        />
      </div>
    </AppShell>
  );
}
