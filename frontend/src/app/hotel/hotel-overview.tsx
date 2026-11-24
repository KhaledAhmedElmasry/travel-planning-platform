// Hotel moderator home (ACC-04; spec section 2, Hotel Moderator row): today's check-ins and
// check-outs, stat cards, quick actions, reservations (5, team leader 24 Nov).
// Props (all from the page):
//   date          today, "YYYY-MM-DD"
//   today         Confirmed stays that include `date` (GET /api/hotels/{id}/reservations?status=confirmed&from=date&to=date)
//   roomsTotal    every room of the hotel (GET /api/hotels/{id}/rooms total)
//   activeRoomIds the active rooms (GET /api/hotels/{id}/rooms?active=true)
//   upcoming      reservations for the list
// Occupancy (team leader 24 Nov) = active rooms with a booked night for today / active rooms.
// The night of `date` is booked when checkIn <= date < checkOut (the check-out day is not a night).
import { BedDoubleIcon, CalendarOffIcon, PercentIcon, PlusIcon, ScrollTextIcon } from "lucide-react";
import { HOME_LIST_SIZE, HomeList, HomeListRow, HomeSection, QuickActions } from "@/components/app/home-section";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { formatDay } from "@/lib/dates";

type BookingStatus = "pending_payment" | "confirmed" | "completed" | "expired" | "cancelled";

/** One item of GET /api/hotels/{id}/reservations (HTL-22). */
export type Reservation = {
  id: string;
  reference: string | null;
  guest: { id: string; name: string };
  rooms: { roomId: string; roomNumber: string; type: string }[];
  checkIn: string;
  checkOut: string;
  status: BookingStatus;
};

type Props = {
  date: string;
  today: Reservation[];
  roomsTotal: number;
  activeRoomIds: string[];
  upcoming: Reservation[];
};

function StayRows({ stays, empty }: { stays: Reservation[]; empty: string }) {
  if (stays.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <HomeList>
      {stays.map((stay) => (
        <HomeListRow key={stay.id}>
          <span className="font-semibold">
            {stay.reference} <span className="font-normal">{stay.guest.name}</span>
          </span>
          <span className="text-sm text-muted-foreground">
            {stay.rooms.map((room) => `Room ${room.roomNumber}`).join(", ")}
          </span>
        </HomeListRow>
      ))}
    </HomeList>
  );
}

export function HotelOverview({ date, today, roomsTotal, activeRoomIds, upcoming }: Props) {
  const active = new Set(activeRoomIds);
  const occupied = new Set(
    today
      .filter((stay) => stay.checkIn <= date && date < stay.checkOut)
      .flatMap((stay) => stay.rooms.map((room) => room.roomId))
      .filter((roomId) => active.has(roomId)),
  );
  const occupancy = active.size === 0 ? 0 : Math.round((occupied.size / active.size) * 100);

  return (
    <div className="grid gap-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Rooms" value={roomsTotal} icon={BedDoubleIcon} href="/hotel/rooms" />
        <StatCard label="Occupancy" value={`${occupancy}%`} icon={PercentIcon} />
        {/* TODO(ask team leader): the "reservations" stat card (spec section 2): count of which
            reservations (confirmed upcoming, all, this month)? */}
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <HomeSection title="Today's check-ins">
          <StayRows stays={today.filter((stay) => stay.checkIn === date)} empty="No check-ins today" />
        </HomeSection>
        <HomeSection title="Today's check-outs">
          <StayRows stays={today.filter((stay) => stay.checkOut === date)} empty="No check-outs today" />
        </HomeSection>
      </div>
      {/* TODO(ask team leader): "recent reservations" (spec section 2): the backend lists
          reservations by check-in date only (no "newest first"); this shows current and future
          stays, soonest check-in first. Is that what you want, or a backend sort by creation? */}
      <HomeSection title="Reservations" seeAll="/hotel/reservations">
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reservations yet</p>
        ) : (
          <HomeList>
            {upcoming.slice(0, HOME_LIST_SIZE).map((stay) => (
              <HomeListRow key={stay.id}>
                <span className="font-semibold">
                  {stay.reference} <span className="font-normal">{stay.guest.name}</span>
                </span>
                <span className="flex items-center gap-3 text-sm">
                  {formatDay(stay.checkIn)} – {formatDay(stay.checkOut)}
                  <StatusBadge kind="booking" status={stay.status} />
                </span>
              </HomeListRow>
            ))}
          </HomeList>
        )}
      </HomeSection>
      <QuickActions
        actions={[
          { label: "Add room", href: "/hotel/rooms", icon: PlusIcon },
          { label: "Block dates", href: "/hotel/rooms", icon: CalendarOffIcon },
          { label: "Policies", href: "/hotel/policies", icon: ScrollTextIcon },
        ]}
      />
    </div>
  );
}
