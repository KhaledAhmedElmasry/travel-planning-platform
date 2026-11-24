"use client";

// LinkBookingDialog, UnlinkBookingButton
// Part: Lead (foundation)
// Requirements: ITN-27 (Bonus), GEN-03, GEN-04, GEN-05, GEN-06, GEN-16, PAY-04
// Used by: P-26
// Endpoints: GET /api/flight-bookings?group=upcoming|past; GET /api/hotel-bookings?group=upcoming|past; POST /api/itineraries/{id}/bookings; DELETE /api/itineraries/{id}/bookings/{linkId}
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
//
// On each DayCard of P-26 (owner only):
//   <LinkBookingDialog
//     itineraryId={itinerary.id} dayId={day.id} dayNumber={day.dayNumber}
//     linkedBookingIds={itinerary.linkedBookings.map((l) => l.bookingId)}
//     onLinked={(link) => ...add link to the day, reload the budget summary...} />
//   Renders its own "Link a booking" button. The dialog lists the user's Confirmed and Completed
//   (past trip, team leader decision 24 Nov) flights and hotel reservations, with their status
//   (Flights / Hotels tabs, 10 per page) that are not linked to this itinerary yet; "Link"
//   on a row links it to this day (toast "Booking linked to Day N"). An error (e.g. 409 already linked
//   to another itinerary) is shown inside the dialog. Linked bookings are shown by the page (DayCard,
//   from GET /api/itineraries/{id} linkedBookings) and their prices by BudgetSummary
//   (grandTotalWithBookings, never converted).
//
// Next to each linked booking the page shows:
//   <UnlinkBookingButton itineraryId={itinerary.id} linkId={link.id}
//     onUnlinked={(linkId) => ...remove it from the day, reload the budget summary...} />
//   Asks first (GEN-03); the booking stays booked, only the link is removed.
import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { LinkIcon, Unlink2Icon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState } from "@/components/app/empty-state";
import { ErrorState } from "@/components/app/error-state";
import { Price } from "@/components/app/price";
import { StatusBadge } from "@/components/app/status-badge";
import type { FlightBookingListItem, HotelBookingListItem } from "@/components/app/bookings/booking-list-item";
import { CABIN_LABEL_FALLBACK } from "@/components/app/checkout/cabin-labels";
import { localDateTime } from "@/components/app/checkout/confirmation-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDay } from "@/lib/dates";

/** openapi LinkedBooking (POST /api/itineraries/{id}/bookings, GET /api/itineraries/{id} linkedBookings). */
export type LinkedBooking = {
  id: string;
  bookingType: "flight" | "hotel";
  bookingId: string;
  dayId: string;
  reference: string | null;
  description: string;
  /** Decimal amount in the platform currency (never converted). */
  amount: number;
  currency: string;
  status: "confirmed" | "completed";
};

type Kind = "flight" | "hotel";
type Page<T> = { items: T[]; page: number; totalPages: number };
type Lists = { flight: FlightBookingListItem[]; hotel: HotelBookingListItem[] };

const PAGE_SIZE = 10;

/** Every page of one group of the user's bookings of one kind. */
async function allOfGroup<T>(kind: Kind, group: "upcoming" | "past"): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const res = await apiFetch<Page<T>>(`/api/${kind}-bookings?group=${group}&page=${page}`);
    items.push(...res.items);
    if (page >= res.totalPages) return items;
  }
}

/** Upcoming (Confirmed, also Pending Payment) then past (Completed, also Expired) bookings. */
async function allBookings<T>(kind: Kind): Promise<T[]> {
  const [upcoming, past] = await Promise.all([allOfGroup<T>(kind, "upcoming"), allOfGroup<T>(kind, "past")]);
  return [...upcoming, ...past];
}

const LINKABLE = ["confirmed", "completed"];

type Props = {
  itineraryId: string;
  dayId: string;
  dayNumber: number;
  /** bookingId of every booking already linked to this itinerary (hidden from the list). */
  linkedBookingIds: string[];
  onLinked: (link: LinkedBooking) => void;
};

export function LinkBookingDialog({ itineraryId, dayId, dayNumber, linkedBookingIds, onLinked }: Props) {
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<Lists | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const loadId = useRef(0);

  // Loads fresh lists each time the dialog opens (and on Retry); a late answer of an older load is dropped.
  function load() {
    const id = ++loadId.current;
    setLists(null);
    setLoadError(null);
    Promise.all([allBookings<FlightBookingListItem>("flight"), allBookings<HotelBookingListItem>("hotel")])
      .then(([flight, hotel]) => id === loadId.current && setLists({ flight, hotel }))
      .catch((error: unknown) => id === loadId.current && setLoadError(error instanceof Error ? error.message : String(error)));
  }

  function changeOpen(next: boolean) {
    if (linking) return;
    setOpen(next);
    setLinkError(null);
    if (next) load();
  }

  async function link(kind: Kind, bookingId: string) {
    setLinking(bookingId);
    setLinkError(null);
    try {
      const linked = await apiFetch<LinkedBooking>(`/api/itineraries/${itineraryId}/bookings`, {
        method: "POST",
        json: { bookingType: kind, bookingId, dayId },
      });
      toast.success(`Booking linked to Day ${dayNumber}`);
      setOpen(false);
      onLinked(linked);
    } catch (error) {
      setLinkError(error instanceof ApiError ? error.message : "Could not link the booking. Try again.");
    } finally {
      setLinking(null);
    }
  }

  const linkable = <T extends { id: string; status: string }>(items: T[]) =>
    items.filter((b) => LINKABLE.includes(b.status) && !linkedBookingIds.includes(b.id));

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <LinkIcon aria-hidden="true" />
          Link a booking
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link a booking to Day {dayNumber}</DialogTitle>
          <DialogDescription>
            Pick one of your confirmed or completed bookings. Its price is added to this itinerary&apos;s budget.
          </DialogDescription>
        </DialogHeader>
        {linkError && (
          <p role="alert" className="text-sm text-error">
            {linkError}
          </p>
        )}
        {loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : !lists ? (
          <div className="grid gap-2" aria-label="Loading bookings">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : (
          <Tabs defaultValue="flight">
            <TabsList>
              <TabsTrigger value="flight">Flights</TabsTrigger>
              <TabsTrigger value="hotel">Hotels</TabsTrigger>
            </TabsList>
            <TabsContent value="flight" className="pt-2">
              <PagedList
                items={linkable(lists.flight)}
                empty={
                  <EmptyState
                    compact
                    title="No confirmed or completed flights"
                    description="Book a flight first, then link it here."
                    action={
                      <Button asChild>
                        <Link href="/flights">Search flights</Link>
                      </Button>
                    }
                  />
                }
                row={(b) => (
                  <BookingRow
                    key={b.id}
                    title={`${b.flightNumber} · ${b.departureAirport} → ${b.arrivalAirport}`}
                    detail={`${localDateTime(b.departureLocal)} · ${CABIN_LABEL_FALLBACK[b.cabinClass] ?? b.cabinClass}`}
                    reference={b.reference}
                    status={b.status}
                    linkLabel={`Link ${b.flightNumber}`}
                    loading={linking === b.id}
                    disabled={linking !== null}
                    onLink={() => link("flight", b.id)}
                  />
                )}
              />
            </TabsContent>
            <TabsContent value="hotel" className="pt-2">
              <PagedList
                items={linkable(lists.hotel)}
                empty={
                  <EmptyState
                    compact
                    title="No confirmed or completed hotel reservations"
                    description="Book a hotel first, then link it here."
                    action={
                      <Button asChild>
                        <Link href="/hotels">Search hotels</Link>
                      </Button>
                    }
                  />
                }
                row={(b) => (
                  <BookingRow
                    key={b.id}
                    title={b.hotel.name}
                    detail={`${formatDay(b.checkIn)} – ${formatDay(b.checkOut)}`}
                    price={<Price cents={b.totalAmount} currency={b.currency} size="sm" />}
                    reference={b.reference}
                    status={b.status}
                    linkLabel={`Link ${b.hotel.name}`}
                    loading={linking === b.id}
                    disabled={linking !== null}
                    onLink={() => link("hotel", b.id)}
                  />
                )}
              />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** 10 rows per page (GEN-05); the backend pages hold Pending Payment ones too, so paging is done here. */
function PagedList<T>({ items, empty, row }: { items: T[]; empty: ReactNode; row: (item: T) => ReactNode }) {
  const [page, setPage] = useState(1);
  if (items.length === 0) return empty;
  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const current = Math.min(page, totalPages);
  return (
    <div className="grid gap-3">
      <ul className="grid gap-2">{items.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE).map(row)}</ul>
      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" disabled={current === 1} onClick={() => setPage(current - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {current} of {totalPages}
          </span>
          <Button variant="ghost" size="sm" disabled={current === totalPages} onClick={() => setPage(current + 1)}>
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}

function BookingRow(props: {
  title: string;
  detail: string;
  reference: string | null;
  status: string;
  price?: ReactNode;
  linkLabel: string;
  loading: boolean;
  disabled: boolean;
  onLink: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="grid gap-0.5">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {props.title}
          <StatusBadge kind="booking" status={props.status as "confirmed"} />
        </p>
        <p className="text-sm text-muted-foreground">{props.detail}</p>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {props.reference && <span className="font-mono">{props.reference}</span>}
          {props.price}
        </p>
      </div>
      <Button size="sm" aria-label={props.linkLabel} loading={props.loading} disabled={props.disabled} onClick={props.onLink}>
        Link
      </Button>
    </li>
  );
}

export function UnlinkBookingButton({
  itineraryId,
  linkId,
  onUnlinked,
}: {
  itineraryId: string;
  /** LinkedBooking.id (not the booking id). */
  linkId: string;
  onUnlinked: (linkId: string) => void;
}) {
  async function unlink() {
    try {
      await apiFetch(`/api/itineraries/${itineraryId}/bookings/${linkId}`, { method: "DELETE" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not unlink the booking. Try again.");
      throw error; // keeps the dialog open
    }
    toast.success("Booking unlinked");
    onUnlinked(linkId);
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm">
          <Unlink2Icon aria-hidden="true" />
          Unlink
        </Button>
      }
      title="Unlink this booking?"
      description="It stays booked; it is only removed from this day and the budget."
      confirmLabel="Unlink"
      cancelLabel="Keep it linked"
      onConfirm={unlink}
    />
  );
}
