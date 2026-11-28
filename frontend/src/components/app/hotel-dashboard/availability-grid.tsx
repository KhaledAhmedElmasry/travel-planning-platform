// AvailabilityGrid
// Part: T6 Hotel dashboard
// Requirements: HTL-08
// Used by: P-45
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
// Built (27 Nov). <AvailabilityGrid rooms={data.items} />
// Rooms as rows, dates as columns; each cell is Available, Booked (with the reservation reference) or
// Blocked (StatusBadge kind="night"). Dates outside a room's bookable ranges come from the backend as
// Blocked. The table scrolls sideways inside its own box and the room column stays in view.
import { StatusBadge } from "@/components/app/status-badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fromDateString } from "@/lib/dates";

/** The backend accepts at most 366 days per request (GET /api/hotels/{id}/availability). */
export const MAX_RANGE_DAYS = 366;

/** One date of one room (HTL-08). */
export type RoomNight = {
  date: string;
  status: "available" | "booked" | "blocked";
  reference: string | null;
};

/** One item of GET /api/hotels/{id}/availability. */
export type RoomAvailabilityRow = {
  id: string;
  roomNumber: string;
  dates: RoomNight[];
};

function dayLabel(value: string): string {
  const date = fromDateString(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(date);
}

export function AvailabilityGrid({ rooms }: { rooms: RoomAvailabilityRow[] }) {
  const days = rooms[0]?.dates.map((night) => night.date) ?? [];

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <Table>
        <TableCaption className="sr-only">Availability of each room for the chosen dates</TableCaption>
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            <TableHead
              scope="col"
              className="sticky left-0 z-10 h-11 bg-muted px-4 text-xs font-semibold tracking-wide text-subtle-foreground uppercase"
            >
              Room
            </TableHead>
            {days.map((day) => (
              <TableHead
                key={day}
                scope="col"
                className="h-11 px-3 text-xs font-semibold tracking-wide whitespace-nowrap text-subtle-foreground uppercase"
              >
                {dayLabel(day)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rooms.map((room) => {
            const byDate = new Map(room.dates.map((night) => [night.date, night]));
            return (
              <TableRow key={room.id}>
                <TableCell className="sticky left-0 z-10 bg-card px-4 py-3 font-semibold whitespace-nowrap">
                  Room {room.roomNumber}
                </TableCell>
                {days.map((day) => {
                  const night = byDate.get(day);
                  return (
                    <TableCell key={day} className="px-3 py-3">
                      {night ? (
                        <StatusBadge kind="night" status={night.status} detail={night.reference ?? undefined} />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
