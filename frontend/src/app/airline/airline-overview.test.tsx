// Airline moderator home (/airline): upcoming flights with seats remaining, stat cards, quick actions
// (ACC-04; spec section 2, Airline Moderator row).
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { AirlineOverview, type AirlineFlight } from "./airline-overview";

afterEach(cleanup);

// source: backend/src/flights/flights.service.ts FlightResponse + CabinResponse (GET /api/airlines/{id}/flights?status=scheduled); Mock Data airports CAI, DXB
const flight = (i: number, economyLeft = 100, businessLeft = 10): AirlineFlight => ({
  id: `f${i}`,
  flightNumber: `DA10${i}`,
  departureAirport: "CAI",
  arrivalAirport: "DXB",
  departureLocal: `2027-03-0${i}T08:00`,
  status: "scheduled",
  cabins: [
    { id: "c1", cabinClass: "economy", seats: 120, bookedSeats: 20, heldSeats: 0, availableSeats: economyLeft, price: 25000, freeBags: 1, maxBagWeightKg: 23 },
    { id: "c2", cabinClass: "business", seats: 12, bookedSeats: 2, heldSeats: 0, availableSeats: businessLeft, price: 90000, freeBags: 2, maxBagWeightKg: 32 },
  ],
});

// source: MILESTONE2_FRONTEND_SPEC.md section 2 Airline Moderator row - upcoming flights list with seats remaining
test("an upcoming flight shows its number, route, local departure and the seats left per cabin, and opens it", () => {
  render(<AirlineOverview flights={[flight(1, 100, 10)]} />);

  const row = screen.getByRole("link", { name: /DA101/ });
  expect(row.getAttribute("href")).toBe("/airline/flights/f1");
  expect(row.textContent).toContain("CAI → DXB");
  expect(row.textContent).toContain("2027-03-01 08:00");
  expect(row.textContent).toContain("Economy 100");
  expect(row.textContent).toContain("Business 10");
});

// source: team leader decision 24 Nov - lists on the homes show 5 items + a "See all" link
test("at most 5 upcoming flights, with See all to the flights page", () => {
  render(<AirlineOverview flights={[1, 2, 3, 4, 5, 6].map((i) => flight(i))} />);

  const region = screen.getByRole("region", { name: "Upcoming flights" });
  expect(within(region).getAllByRole("link", { name: /DA10/ }).map((a) => a.getAttribute("href"))).toEqual([
    "/airline/flights/f1",
    "/airline/flights/f2",
    "/airline/flights/f3",
    "/airline/flights/f4",
    "/airline/flights/f5",
  ]);
  expect(within(region).getByRole("link", { name: "See all" }).getAttribute("href")).toBe("/airline/flights");
});

// source: MILESTONE2_FRONTEND_SPEC.md section 2 Airline Moderator row - stat cards (scheduled flights, seats left)
test("the stat cards count every scheduled flight and add up the seats left in all their cabins", () => {
  render(<AirlineOverview flights={[flight(1, 100, 10), flight(2, 50, 0), flight(3, 7, 3), flight(4), flight(5), flight(6)]} />);

  expect(screen.getByText("Scheduled flights").parentElement!.textContent).toBe("Scheduled flights6");
  // 110 + 50 + 10 + 3 x 110 = 500
  expect(screen.getByText("Seats left").parentElement!.textContent).toBe("Seats left500");
});

// source: MILESTONE2_FRONTEND_SPEC.md section 2 Airline Moderator row - quick actions (create flight, edit policies); routes in src/lib/nav.ts
test("quick actions open create flight and the two policy pages", () => {
  render(<AirlineOverview flights={[]} />);

  const region = screen.getByRole("region", { name: "Quick actions" });
  const hrefs = within(region).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")]);
  expect(hrefs).toEqual([
    ["Create flight", "/airline/flights/new"],
    ["Baggage policy", "/airline/baggage-policy"],
    ["Cancellation policy", "/airline/cancellation-policy"],
  ]);
});

// source: Excel GEN-04 - empty lists show a helpful empty state
test("no scheduled flight shows an empty state with Create flight", () => {
  render(<AirlineOverview flights={[]} />);

  const region = screen.getByRole("region", { name: "Upcoming flights" });
  expect(within(region).getByText("No upcoming flights")).toBeTruthy();
  expect(within(region).getByRole("link", { name: "Create flight" }).getAttribute("href")).toBe("/airline/flights/new");
});
