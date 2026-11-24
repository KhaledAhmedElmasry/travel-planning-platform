// User home blocks (ACC-04; spec section 2, Registered User row): upcoming trips (the next flight
// bookings and hotel stays, 5 of each, team leader 24 Nov) and the My itineraries shortcut.
// The lists come from GET /api/flight-bookings?group=upcoming and GET /api/hotel-bookings?group=upcoming
// (FLT-25, HTL-20), already sorted soonest first by the backend.
import Link from "next/link";
import { BedDoubleIcon, MapIcon, PlaneIcon } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { HOME_LIST_SIZE, HomeList, HomeListRow, HomeSection } from "@/components/app/home-section";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/dates";

type BookingStatus = "pending_payment" | "confirmed" | "completed" | "expired" | "cancelled";

/** One item of GET /api/flight-bookings (openapi FlightBookingList). */
export type UpcomingFlight = {
  id: string;
  reference: string | null;
  status: BookingStatus;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureAt: string;
  departureLocal: string;
  passengers: number;
  cabinClass: string;
};
/** One item of GET /api/hotel-bookings (openapi HotelBookingList). */
export type UpcomingHotel = {
  id: string;
  reference: string | null;
  status: BookingStatus;
  hotel: { id: string; name: string };
  rooms: { roomId: string; roomNumber: string; type: string }[];
  checkIn: string;
  checkOut: string;
  guests: { adults: number; children: number };
  totalAmount: number;
  currency: string;
};

export function UpcomingTrips({ flights, hotels }: { flights: UpcomingFlight[]; hotels: UpcomingHotel[] }) {
  const empty = flights.length === 0 && hotels.length === 0;
  return (
    <HomeSection title="Upcoming trips" seeAll={empty ? undefined : "/bookings"}>
      {empty ? (
        <EmptyState
          compact
          title="No upcoming trips"
          action={
            <Button asChild>
              <Link href="/flights">Search flights</Link>
            </Button>
          }
        />
      ) : (
        <HomeList>
          {flights.slice(0, HOME_LIST_SIZE).map((booking) => (
            <HomeListRow key={booking.id} href={`/bookings/flights/${booking.id}`}>
              <span className="flex items-center gap-2 font-semibold">
                <PlaneIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                {booking.reference}
                <span className="font-normal text-muted-foreground">
                  {booking.flightNumber} · {booking.departureAirport} → {booking.arrivalAirport}
                </span>
              </span>
              <span className="flex items-center gap-3 text-sm">
                <span className="tabular">{booking.departureLocal.replace("T", " ")}</span>
                <StatusBadge kind="booking" status={booking.status} />
              </span>
            </HomeListRow>
          ))}
          {hotels.slice(0, HOME_LIST_SIZE).map((booking) => (
            <HomeListRow key={booking.id} href={`/bookings/hotels/${booking.id}`}>
              <span className="flex items-center gap-2 font-semibold">
                <BedDoubleIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                {booking.reference}
                <span className="font-normal text-muted-foreground">{booking.hotel.name}</span>
              </span>
              <span className="flex items-center gap-3 text-sm">
                <span>
                  {formatDay(booking.checkIn)} – {formatDay(booking.checkOut)}
                </span>
                <StatusBadge kind="booking" status={booking.status} />
              </span>
            </HomeListRow>
          ))}
        </HomeList>
      )}
    </HomeSection>
  );
}

export function ItinerariesShortcut() {
  return (
    <Link
      href="/my/itineraries"
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 font-semibold transition-colors hover:border-input"
    >
      <MapIcon className="size-5 text-cyan" aria-hidden="true" />
      My itineraries
    </Link>
  );
}
