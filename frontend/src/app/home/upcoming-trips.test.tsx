// User home (/home): upcoming trips and the My itineraries shortcut (ACC-04, spec section 2).
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ItinerariesShortcut, UpcomingTrips, type UpcomingFlight, type UpcomingHotel } from "./upcoming-trips";

afterEach(cleanup);

// source: openapi FlightBookingList item (GET /api/flight-bookings?group=upcoming); Mock Data airports CAI, DXB
const flight = (i: number): UpcomingFlight => ({
  id: `fb${i}`,
  reference: `TPF00${i}`,
  status: "confirmed",
  flightNumber: `NA10${i}`,
  departureAirport: "CAI",
  arrivalAirport: "DXB",
  departureAt: "2027-03-01T06:00:00.000Z",
  departureLocal: "2027-03-01T08:00",
  passengers: 2,
  cabinClass: "economy",
});
// source: openapi HotelBookingList item (GET /api/hotel-bookings?group=upcoming)
const hotel = (i: number): UpcomingHotel => ({
  id: `hb${i}`,
  reference: `TPH00${i}`,
  status: "confirmed",
  hotel: { id: "h1", name: "Nile View Hotel" },
  rooms: [{ roomId: "r1", roomNumber: "101", type: "Double" }],
  checkIn: "2027-03-01",
  checkOut: "2027-03-04",
  guests: { adults: 2, children: 0 },
  totalAmount: 49500,
  currency: "USD",
});

// source: MILESTONE2_FRONTEND_SPEC.md section 2 Registered User row - upcoming trips (next flight and hotel bookings)
test("an upcoming flight shows its reference, flight, route and local departure, and opens its details", () => {
  render(<UpcomingTrips flights={[flight(1)]} hotels={[]} />);

  const link = screen.getByRole("link", { name: /TPF001/ });
  expect(link.getAttribute("href")).toBe("/bookings/flights/fb1");
  expect(link.textContent).toContain("NA101");
  expect(link.textContent).toContain("CAI");
  expect(link.textContent).toContain("DXB");
  expect(link.textContent).toContain("2027-03-01 08:00");
});

// source: MILESTONE2_FRONTEND_SPEC.md section 2 - upcoming trips; P-22 row: reference, hotel, dates
test("an upcoming hotel stay shows its reference, hotel and dates, and opens its details", () => {
  render(<UpcomingTrips flights={[]} hotels={[hotel(1)]} />);

  const link = screen.getByRole("link", { name: /TPH001/ });
  expect(link.getAttribute("href")).toBe("/bookings/hotels/hb1");
  expect(link.textContent).toContain("Nile View Hotel");
  expect(link.textContent).toContain("Mon, 1 Mar 2027");
  expect(link.textContent).toContain("Thu, 4 Mar 2027");
});

// source: team leader decision 24 Nov - every recent/upcoming list on the homes shows 5 items + a "See all" link
test("at most 5 flights and 5 stays are shown, with a See all link to My bookings", () => {
  const many = [1, 2, 3, 4, 5, 6];
  render(<UpcomingTrips flights={many.map(flight)} hotels={many.map(hotel)} />);

  const region = screen.getByRole("region", { name: "Upcoming trips" });
  expect(within(region).getAllByRole("link", { name: /TPF00/ })).toHaveLength(5);
  expect(within(region).getAllByRole("link", { name: /TPH00/ })).toHaveLength(5);
  expect(within(region).queryByRole("link", { name: /TPF006/ })).toBeNull();
  expect(within(region).getByRole("link", { name: "See all" }).getAttribute("href")).toBe("/bookings");
});

// source: Excel GEN-04 - empty lists show a helpful empty state
test("no upcoming trip shows an empty state that leads to the flight search", () => {
  render(<UpcomingTrips flights={[]} hotels={[]} />);

  const region = screen.getByRole("region", { name: "Upcoming trips" });
  expect(within(region).getByText("No upcoming trips")).toBeTruthy();
  expect(within(region).getByRole("link", { name: "Search flights" }).getAttribute("href")).toBe("/flights");
});

// source: MILESTONE2_FRONTEND_SPEC.md section 2 Registered User row - My itineraries shortcut
test("the My itineraries shortcut opens /my/itineraries", () => {
  render(<ItinerariesShortcut />);
  expect(screen.getByRole("link", { name: /My itineraries/ }).getAttribute("href")).toBe("/my/itineraries");
});

// source: tip for a user with no bookings yet, chosen by Khaled (popup, 25 Nov 2026)
test("with no upcoming trip, So3ad's tip invites a first search", () => {
  const { container } = render(<UpcomingTrips flights={[]} hotels={[]} />);

  expect(screen.getByText("“Start with a search, I’ll find the deals.”")).toBeDefined();
  expect(container.querySelector('svg[data-pose="avatar"]')).not.toBeNull();
});

// source: same tip is for a user with no bookings only
test("with an upcoming trip there is no search tip", () => {
  render(<UpcomingTrips flights={[flight(1)]} hotels={[]} />);

  expect(screen.queryByText("“Start with a search, I’ll find the deals.”")).toBeNull();
});
