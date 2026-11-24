// P-20, P-22 My bookings (FLT-25, HTL-20, GEN-04, GEN-05).
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import type { FlightBookingListItem, HotelBookingListItem } from "@/components/app/bookings/booking-list-item";
import { MyBookingsView, parseBookingsQuery } from "./my-bookings-view";

afterEach(cleanup);

// source: backend flight-bookings.service.ts toListItem() (holdExpiresAt: PR #288); Mock Data airports CAI, DXB
const flight: FlightBookingListItem = {
  id: "fb1",
  reference: "TP7K2Q",
  status: "confirmed",
  flightNumber: "NA101",
  departureAirport: "CAI",
  arrivalAirport: "DXB",
  departureAt: "2027-03-01T06:00:00.000Z",
  departureLocal: "2027-03-01 08:00 (Africa/Cairo)",
  passengers: 2,
  cabinClass: "economy",
  holdExpiresAt: null,
};
// source: backend hotel-bookings.service.ts toListItem()
const hotel: HotelBookingListItem = {
  id: "hb1",
  reference: "TP9X4Z",
  status: "confirmed",
  hotel: { id: "h1", name: "Nile View Hotel" },
  rooms: [{ roomId: "r1", roomNumber: "101", type: "Double" }],
  checkIn: "2027-03-01",
  checkOut: "2027-03-04",
  guests: { adults: 2, children: 0 },
  totalAmount: 49500,
  currency: "USD",
  holdExpiresAt: null,
};

const page = <T,>(items: T[], extra: Partial<{ page: number; total: number; totalPages: number }> = {}) => ({
  items,
  page: 1,
  pageSize: 10,
  total: items.length,
  totalPages: 1,
  ...extra,
});

// source: team leader decision 24 Nov - /bookings layout: a Flights | Hotels switch, then the tabs for the chosen type
test("a Flights | Hotels switch, then Upcoming / Past / Cancelled tabs that keep the chosen type", () => {
  render(<MyBookingsView type="hotels" tab="past" list={page([])} />);

  const types = screen.getByRole("navigation", { name: "Booking type" });
  expect(within(types).getByRole("link", { name: "Flights" }).getAttribute("href")).toBe("/bookings?type=flights&tab=upcoming");
  expect(within(types).getByRole("link", { name: "Hotels" }).getAttribute("aria-current")).toBe("page");

  // source: Excel HTL-20 - grouped as Upcoming, Past and Cancelled
  const tabs = screen.getByRole("navigation", { name: "Booking group" });
  expect(within(tabs).getAllByRole("link").map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
    ["Upcoming", "/bookings?type=hotels&tab=upcoming"],
    ["Past", "/bookings?type=hotels&tab=past"],
    ["Cancelled", "/bookings?type=hotels&tab=cancelled"],
  ]);
  expect(within(tabs).getByRole("link", { name: "Past" }).getAttribute("aria-current")).toBe("page");
});

// source: Excel FLT-25 - view flight bookings, open full details; team leader decision 24 Nov - one list at a time
test("flights show only flight rows", () => {
  render(<MyBookingsView type="flights" tab="upcoming" list={page([flight])} />);
  expect(screen.getByRole("link", { name: /NA101/ }).getAttribute("href")).toBe("/bookings/flights/fb1");
  expect(screen.queryByText("Nile View Hotel")).toBeNull();
});

// source: Excel HTL-20 - view hotel reservations, open full details
test("hotels show only hotel rows", () => {
  render(<MyBookingsView type="hotels" tab="upcoming" list={page([hotel])} />);
  expect(screen.getByRole("link", { name: /Nile View Hotel/ }).getAttribute("href")).toBe("/bookings/hotels/hb1");
});

// source: Excel GEN-04 - friendly empty state when a list returns nothing
test("an empty group shows an empty state with a way to search", () => {
  render(<MyBookingsView type="flights" tab="cancelled" list={page([])} />);
  expect(screen.getByRole("heading", { name: "No cancelled flight bookings" })).toBeDefined();
  expect(screen.getByRole("link", { name: "Search flights" }).getAttribute("href")).toBe("/flights");
});

// source: Excel GEN-05 - lists longer than 10 are paginated; the page links keep the type and the tab
test("pages keep the type and the tab", () => {
  render(<MyBookingsView type="hotels" tab="past" list={page([hotel], { page: 1, total: 12, totalPages: 2 })} />);
  expect(screen.getByRole("link", { name: "2" }).getAttribute("href")).toBe("/bookings?type=hotels&tab=past&page=2");
});

// source: backend list DTOs - group is upcoming | past | cancelled (default upcoming); team leader decision 24 Nov - flights | hotels
test("the URL query falls back to flights, upcoming, page 1 for missing or unknown values", () => {
  expect(parseBookingsQuery({})).toEqual({ type: "flights", tab: "upcoming", page: 1 });
  expect(parseBookingsQuery({ type: "hotels", tab: "past", page: "3" })).toEqual({ type: "hotels", tab: "past", page: 3 });
  expect(parseBookingsQuery({ type: "cars", tab: "soon", page: "-2" })).toEqual({ type: "flights", tab: "upcoming", page: 1 });
  expect(parseBookingsQuery({ page: "0" }).page).toBe(1);
  expect(parseBookingsQuery({ page: "1.5" }).page).toBe(1);
});
