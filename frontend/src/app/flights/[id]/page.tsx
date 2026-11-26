// P-13 Flight details: /flights/[id]
// Part: T1 Flights + itinerary list
// Requirements: FLT-17, GEN-06
// Endpoints: GET /api/flights/{id}
// Rendering: Dynamic SSR. Not in .md section 9, decided by the team leader (23 Nov): public, but seats remaining change every minute (10-minute holds), so the data must be fresh on every request; add SEO metadata (public page).
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-13). Use a shell and kit components (frontend/README.md).
// Built: FlightDetailsPanel with everything the endpoint returns (FLT-17), times in each airport's zone
// (GEN-06), a Book button per cabin that opens P-14 (hidden for sold-out cabins and flights that can no
// longer be booked), SEO metadata from the flight, and the 404 page for an unknown or invalid id.
// Guests and every role can open it (PublicShell with the session); backendFetch is never cached.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PageHeader } from "@/components/app/page-header";
import { FlightDetailsPanel, type FlightDetailsData } from "@/components/app/flights/flight-details-panel";
import { PublicShell } from "@/components/layout/public-shell";
import { backendFetch } from "@/lib/server/backend";
import { getSessionUser, getUnreadCount } from "@/lib/server/session";

type Props = { params: Promise<{ id: string }> };

/** The flight, or null for an unknown flight (404) or an id that is not a valid id (400). Read once per request. */
const loadFlight = cache(async (id: string): Promise<FlightDetailsData | null> => {
  const res = await backendFetch(`/api/flights/${encodeURIComponent(id)}`);
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`GET /api/flights/${id} failed with ${res.status}`);
  return (await res.json()) as FlightDetailsData;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const flight = await loadFlight(id);
  if (!flight) return { title: "Flight not found", robots: { index: false } };
  const title = `${flight.airline.name} ${flight.flightNumber}: ${flight.departureAirport.iataCode} to ${flight.arrivalAirport.iataCode}`;
  const description = `${flight.airline.name} flight ${flight.flightNumber} from ${flight.departureAirport.name} to ${flight.arrivalAirport.name}: times, cabins, fares, baggage and cancellation policy.`;
  return {
    title,
    description,
    alternates: { canonical: `/flights/${flight.id}` },
    openGraph: { type: "website", siteName: "Yallaway", title, description },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const [flight, user] = await Promise.all([loadFlight(id), getSessionUser()]);
  if (!flight) notFound();
  const unread = user ? await getUnreadCount() : 0;

  return (
    <PublicShell user={user} unreadNotifications={unread}>
      <div className="max-w-4xl">
        <PageHeader
          title={`${flight.airline.name} ${flight.flightNumber}`}
          description={`${flight.departureAirport.iataCode} to ${flight.arrivalAirport.iataCode}`}
          back={{ href: "/flights", label: "Flight search" }}
        />
        <FlightDetailsPanel flight={flight} bookHref={(cabinClass) => `/flights/${flight.id}/book?cabinClass=${cabinClass}`} />
      </div>
    </PublicShell>
  );
}
