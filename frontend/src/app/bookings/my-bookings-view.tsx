// P-20, P-22 My bookings view (FLT-25, HTL-20, GEN-04, GEN-05).
// Layout (team leader, 24 Nov): a Flights | Hotels switch, then the Upcoming / Past / Cancelled tabs
// of the chosen type; one list at a time. Everything lives in the URL (?type=&tab=&page=), so the
// server page renders it and back / shared links land on the same list.
import Link from "next/link";
import {
  BookingListItem,
  type FlightBookingListItem,
  type HotelBookingListItem,
} from "@/components/app/bookings/booking-list-item";
import { EmptyState } from "@/components/app/empty-state";
import { PaginationBar } from "@/components/app/pagination-bar";
import { Button } from "@/components/ui/button";

export type BookingType = "flights" | "hotels";
/** The backend's `group` query value (list DTOs). */
export type BookingTab = "upcoming" | "past" | "cancelled";

export type Paginated<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number };

type Props =
  | { type: "flights"; tab: BookingTab; list: Paginated<FlightBookingListItem> }
  | { type: "hotels"; tab: BookingTab; list: Paginated<HotelBookingListItem> };

const TYPES: { value: BookingType; label: string }[] = [
  { value: "flights", label: "Flights" },
  { value: "hotels", label: "Hotels" },
];
const TABS: { value: BookingTab; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "cancelled", label: "Cancelled" },
];

/** ?type=&tab=&page= -> known values only (anything else falls back to the defaults). */
export function parseBookingsQuery(query: Record<string, string | string[] | undefined>) {
  const type: BookingType = query.type === "hotels" ? "hotels" : "flights";
  const tab = TABS.find((t) => t.value === query.tab)?.value ?? "upcoming";
  const page = Number(query.page);
  return { type, tab, page: Number.isInteger(page) && page > 0 ? page : 1 };
}

const href = (type: BookingType, tab: BookingTab, page?: number) =>
  `/bookings?type=${type}&tab=${tab}${page ? `&page=${page}` : ""}`;

export function MyBookingsView(props: Props) {
  const { type, tab, list } = props;
  const noun = type === "flights" ? "flight bookings" : "hotel reservations";
  return (
    <div className="grid gap-6">
      <nav aria-label="Booking type" className="flex gap-2">
        {TYPES.map((t) => (
          <Button key={t.value} asChild variant={t.value === type ? "default" : "outline"}>
            <Link href={href(t.value, "upcoming")} aria-current={t.value === type ? "page" : undefined}>
              {t.label}
            </Link>
          </Button>
        ))}
      </nav>
      <nav aria-label="Booking group" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button key={t.value} asChild size="sm" variant={t.value === tab ? "secondary" : "ghost"}>
            <Link href={href(type, t.value)} aria-current={t.value === tab ? "page" : undefined}>
              {t.label}
            </Link>
          </Button>
        ))}
      </nav>

      {list.items.length === 0 ? (
        // TODO(ask team leader): empty-state texts ("No <tab> flight bookings", "Search flights") are mine.
        <EmptyState
          title={`No ${tab} ${noun}`}
          line="So empty! Let's plan something."
          action={
            <Button asChild>
              <Link href={type === "flights" ? "/flights" : "/hotels"}>
                {type === "flights" ? "Search flights" : "Search hotels"}
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3">
          {props.type === "flights"
            ? props.list.items.map((b) => (
                <li key={b.id}>
                  <BookingListItem kind="flight" booking={b} />
                </li>
              ))
            : props.list.items.map((b) => (
                <li key={b.id}>
                  <BookingListItem kind="hotel" booking={b} />
                </li>
              ))}
        </ul>
      )}

      <PaginationBar
        page={list.page}
        totalPages={list.totalPages}
        total={list.total}
        pageSize={list.pageSize}
        hrefFor={(p) => href(type, tab, p)}
      />
    </div>
  );
}
