// P-19 Book a hotel: /hotels/[id]/book
// Part: T2 Hotels + my posts list
// Requirements: HTL-16, HTL-18, HTL-09, PAY-02
// Endpoints: GET /api/hotels/{id} (summary before the hold); POST /api/hotel-bookings; GET /api/bookings/{type}/{id}/policies; POST /api/bookings/{type}/{id}/accept-policies
// Rendering: Dynamic SSR + Client Components. Not in .md section 9, decided by the team leader (23 Nov): per-user data read with the session cookie on every request, so it can't be cached for everyone; the multi-step form and the 10-minute hold countdown run in the browser.
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-19). Use a shell and kit components (frontend/README.md).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { HotelBookingSummary, type BookingHotel } from "@/components/app/hotels/hotel-booking-summary";
import { AppShell } from "@/components/layout/app-shell";
import { WizardLayout } from "@/components/layout/wizard-layout";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Book a hotel", robots: { index: false } };

type Query = { checkIn?: string | string[]; checkOut?: string | string[]; guests?: string | string[]; rooms?: string | string[] };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const { id } = await params;
  const query = await searchParams;
  const checkIn = first(query.checkIn);
  const checkOut = first(query.checkOut);
  const guests = Number(first(query.guests));
  const rooms = Number(first(query.rooms));
  if (!checkIn || !checkOut || !Number.isInteger(guests) || guests < 1 || !Number.isInteger(rooms) || rooms < 1) notFound();

  const user = await requireUser(["user"]);
  const paramsQuery = new URLSearchParams({ checkIn, checkOut, guests: String(guests) });
  const hotel = await backendJson<BookingHotel>(`/api/hotels/${encodeURIComponent(id)}?${paramsQuery}`);
  if (!hotel) notFound();

  return (
    <AppShell user={user} unreadNotifications={await getUnreadCount()}>
      <div className="grid gap-6">
        <PageHeader title={`Book ${hotel.name}`} description={`${checkIn} to ${checkOut} · ${rooms} room${rooms === 1 ? "" : "s"}`} back={{ href: `/hotels/${id}?${paramsQuery}`, label: "Hotel details" }} />
        <WizardLayout steps={["Guests", "Summary", "Policies", "Payment"]} current={0}>
          <HotelBookingSummary hotel={hotel} requestedRooms={rooms} requestedGuests={guests} checkIn={checkIn} checkOut={checkOut} />
        </WizardLayout>
      </div>
    </AppShell>
  );
}
