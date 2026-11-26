// P-14 Book a flight: /flights/[id]/book
// Part: T1 Flights + itinerary list
// Requirements: FLT-19, FLT-21, FLT-22, FLT-08, FLT-12, PAY-02
// Endpoints: POST /api/flight-bookings/hold; POST /api/flight-bookings; GET /api/bookings/{type}/{id}/policies; POST /api/bookings/{type}/{id}/accept-policies
// Rendering: Dynamic SSR + Client Components. Not in .md section 9, decided by the team leader (23 Nov): per-user data read with the session cookie on every request, so it can't be cached for everyone; the multi-step form and the 10-minute hold countdown run in the browser.
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-14). Use a shell and kit components (frontend/README.md).
// Flights come from P-12 / P-13: /flights/{id}/book?cabinClass=economy&adults=1&children=0&infants=0
// and for a round trip also &returnFlightId=...&returnCabinClass=... (FLT-12). The flights are read with
// GET /api/flights/{id} for the summary before the hold. Only travellers (role user) can book: a guest
// is sent to log in and back (ACC-10). After the hold the page adds &bookingId=..., so a refresh goes on
// to P-16 (it accepts the policies too) instead of holding again, like P-19.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { FlightBookingSummary, type BookingFlight, type PassengerCounts } from "@/components/app/flights/flight-booking-summary";
import type { CabinClass } from "@/components/app/search/flight-search-form";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { backendFetch } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Book a flight", robots: { index: false } };

type Query = Record<string, string | string[] | undefined>;
type FlightForBooking = Omit<BookingFlight, "cabins"> & {
  bookable: boolean;
  bookableReason: string | null;
  cabins: (BookingFlight["cabins"][number] & { soldOut: boolean })[];
};

const CABINS: CabinClass[] = ["economy", "premium_economy", "business", "first"];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function count(value: string | string[] | undefined, fallback: number, min: number): number {
  const n = Number(first(value));
  return Number.isInteger(n) && n >= min ? Math.min(n, 9) : fallback;
}

async function loadFlight(id: string): Promise<FlightForBooking | null> {
  const res = await backendFetch(`/api/flights/${encodeURIComponent(id)}`);
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`GET /api/flights/${id} failed with ${res.status}`);
  return (await res.json()) as FlightForBooking;
}

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const { id } = await params;
  const query = await searchParams;
  const cabin = CABINS.find((c) => c === first(query.cabinClass));
  const returnId = first(query.returnFlightId);
  const returnCabin = CABINS.find((c) => c === first(query.returnCabinClass));
  if (!cabin || (returnId && !returnCabin)) notFound();

  const user = await requireUser(["user"]);
  const bookingId = first(query.bookingId);
  if (bookingId) redirect(`/checkout/flight/${encodeURIComponent(bookingId)}`);

  const [outbound, back] = await Promise.all([loadFlight(id), returnId ? loadFlight(returnId) : Promise.resolve(null)]);
  if (!outbound || (returnId && !back)) notFound();
  const flights = back ? [outbound, back] : [outbound];
  const cabins = back ? [cabin, returnCabin!] : [cabin];

  const adults = count(query.adults, 1, 1);
  const counts: PassengerCounts = {
    adults,
    children: count(query.children, 0, 0),
    infants: Math.min(count(query.infants, 0, 0), adults),
  };

  // A flight that departed or was cancelled, or a sold-out cabin, cannot be booked (FLT-22).
  const blocked = flights.find((f, i) => !f.bookable || !f.cabins.some((c) => c.cabinClass === cabins[i] && !c.soldOut));
  const detailsHref = `/flights/${outbound.id}`;
  const route = `${outbound.departureAirport.iataCode} to ${outbound.arrivalAirport.iataCode}${back ? " and back" : ""}`;

  return (
    <AppShell user={user} unreadNotifications={await getUnreadCount()}>
      <div className="grid gap-6">
        <PageHeader
          title="Book a flight"
          description={`${outbound.airline.name} ${outbound.flightNumber} · ${route}`}
          back={{ href: detailsHref, label: "Flight details" }}
        />
        {blocked ? (
          <EmptyState
            title="This flight can't be booked"
            line={blocked.bookableReason ?? "That cabin is sold out."}
            description="Go back and pick another flight or cabin."
            action={
              <Button asChild>
                <Link href="/flights">Search flights</Link>
              </Button>
            }
          />
        ) : (
          <FlightBookingSummary flights={flights} cabins={cabins} counts={counts} searchHref="/flights" />
        )}
      </div>
    </AppShell>
  );
}
