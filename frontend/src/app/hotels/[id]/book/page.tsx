// P-19 Book a hotel: /hotels/[id]/book
// Part: T2 Hotels + my posts list
// Requirements: HTL-16, HTL-18, HTL-09, PAY-02
// Endpoints: GET /api/hotels/{id} (summary before the hold); POST /api/hotel-bookings; GET /api/bookings/{type}/{id}/policies; POST /api/bookings/{type}/{id}/accept-policies
// Rendering: Dynamic SSR + Client Components. Not in .md section 9, decided by the team leader (23 Nov): per-user data read with the session cookie on every request, so it can't be cached for everyone; the multi-step form and the 10-minute hold countdown run in the browser.
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-19). Use a shell and kit components (frontend/README.md).
// Rooms come from P-18 (HTL-15, team leader 26 Nov): /hotels/{id}/book?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&roomIds=id1,id2
// After the hold the page adds &bookingId=..., so a refresh goes on to P-16 (it accepts the policies too) instead of holding again.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { HotelBookingSummary, type BookingHotel } from "@/components/app/hotels/hotel-booking-summary";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Book a hotel", robots: { index: false } };

type Query = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const { id } = await params;
  const query = await searchParams;
  const checkIn = first(query.checkIn);
  const checkOut = first(query.checkOut);
  const roomIds = [...new Set((first(query.roomIds) ?? "").split(",").map((r) => r.trim()).filter(Boolean))];
  if (!checkIn || !checkOut || roomIds.length === 0) notFound();

  const user = await requireUser(["user"]);
  const bookingId = first(query.bookingId);
  if (bookingId) redirect(`/checkout/hotel/${encodeURIComponent(bookingId)}`);

  const dates = new URLSearchParams({ checkIn, checkOut });
  const hotel = await backendJson<BookingHotel>(`/api/hotels/${encodeURIComponent(id)}?${dates}`);
  if (!hotel) notFound();
  const hotelHref = `/hotels/${id}?${dates}`;
  const free = hotel.availableRooms ?? [];
  const rooms = roomIds.flatMap((roomId) => free.filter((room) => room.id === roomId));
  const allFree = rooms.length === roomIds.length;

  return (
    <AppShell user={user} unreadNotifications={await getUnreadCount()}>
      <div className="grid gap-6">
        <PageHeader title={`Book ${hotel.name}`} description={`${checkIn} to ${checkOut} · ${roomIds.length} room${roomIds.length === 1 ? "" : "s"}`} back={{ href: hotelHref, label: "Hotel details" }} />
        {allFree ? (
          <HotelBookingSummary hotel={hotel} rooms={rooms} checkIn={checkIn} checkOut={checkOut} hotelHref={hotelHref} />
        ) : (
          <EmptyState
            title="No rooms available"
            line="Those rooms are already booked."
            description="Go back and try different dates."
            action={<Button asChild><Link href={hotelHref}>Back to the hotel</Link></Button>}
          />
        )}
      </div>
    </AppShell>
  );
}
