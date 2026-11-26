// P-13 Flight details panel (FLT-17, GEN-06, FLT-08, FLT-09). Rendered like the server page renders it.
import { cleanup, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, test } from "vitest";
import { formatCents } from "@/lib/format";
import { FlightDetailsPanel, type FlightDetailsData } from "./flight-details-panel";

afterEach(cleanup);

// source: openapi GET /api/flights/{id} FlightDetails; spec P-13 (FLT-17)
const airport = (iataCode: string, name: string, timeZone: string) => ({ iataCode, name, cityId: "c", countryCode: "EG", timeZone });
const cabin = (cabinClass: FlightDetailsData["cabins"][number]["cabinClass"], price: number, seatsRemaining: number) => ({
  cabinId: `cab-${cabinClass}`,
  cabinClass,
  price,
  seatsRemaining,
  soldOut: seatsRemaining === 0,
  freeBags: 1,
  maxBagWeightKg: 23,
});
const flight = (over: Partial<FlightDetailsData> = {}): FlightDetailsData => ({
  id: "f1",
  airline: { id: "a1", name: "Nile Air", code: "NA", logoUrl: null },
  flightNumber: "NA101",
  status: "scheduled",
  departureAirport: airport("CAI", "Cairo International Airport", "Africa/Cairo"),
  arrivalAirport: airport("DXB", "Dubai International Airport", "Asia/Dubai"),
  departureAt: "2027-03-01T08:00:00.000Z",
  arrivalAt: "2027-03-01T11:30:00.000Z",
  durationMinutes: 210,
  cabins: [cabin("economy", 15000, 60), cabin("business", 60000, 0)],
  extraBaggage: { extraBagPrice: 5000, maxExtraBagsPerPassenger: 2 },
  cancellationPolicy: { tiers: [{ daysBefore: 14, refundPercentage: 100, description: "Cancel 14 or more days before departure: 100% refund." }], note: null },
  bookable: true,
  bookableReason: null,
  currency: "USD",
  ...over,
});
const bookHref = (c: string) => `/flights/f1/book?cabinClass=${c}`;

test("FLT-17: each cabin shows its name in the server-rendered HTML (the page is a server component)", () => {
  // source: spec P-13 "Each cabin category"; P-12 cabin names Economy / Premium Economy / Business / First
  const html = renderToString(<FlightDetailsPanel flight={flight()} bookHref={bookHref} />);
  expect(html).toContain("Economy");
  expect(html).toContain("Business");
});

test("FLT-17: each cabin shows price, seats remaining and free baggage", () => {
  // source: spec P-13 "price, seats remaining, baggage allowance (free bag count and max kg per bag)"
  render(<FlightDetailsPanel flight={flight()} bookHref={bookHref} />);
  const economy = screen.getAllByText("Economy")[0].closest("li")!;
  expect(within(economy).getByText(formatCents(15000, "USD").replace(/\s*USD$/, ""), { exact: false })).toBeTruthy();
  expect(within(economy).getByText("60 seats left · 1 free bag up to 23 kg")).toBeTruthy();
});

test("FLT-17: Book opens P-14 with only ?cabinClass= and is hidden for a sold-out cabin", () => {
  // source: team leader 26 Nov "cabinClass only"; spec P-13 "Book" button
  render(<FlightDetailsPanel flight={flight()} bookHref={bookHref} />);
  expect(screen.getByRole("link", { name: "Book Economy" }).getAttribute("href")).toBe("/flights/f1/book?cabinClass=economy");
  expect(screen.queryByRole("link", { name: "Book Business" })).toBeNull();
});

test("FLT-17: a flight that cannot be booked shows the backend reason and no Book button", () => {
  // source: openapi FlightDetails bookable / bookableReason
  render(<FlightDetailsPanel flight={flight({ bookable: false, bookableReason: "This flight has departed." })} bookHref={bookHref} />);
  expect(screen.getByRole("status").textContent).toBe("This flight has departed.");
  expect(screen.queryByRole("link", { name: /^Book/ })).toBeNull();
});

test("FLT-17: the airline logo shows when the airline has one", () => {
  // source: spec P-13 "Airline (name and logo)"; team leader 26 Nov "Show logo if present"
  render(<FlightDetailsPanel flight={flight({ airline: { id: "a1", name: "Nile Air", code: "NA", logoUrl: "/uploads/airlines/na.png" } })} />);
  expect(screen.getByRole("img", { name: "Nile Air logo" }).getAttribute("src")).toBe("/uploads/airlines/na.png");
});

test("FLT-17: no logo image when the airline has none", () => {
  // source: team leader 26 Nov "name only when it is null"
  render(<FlightDetailsPanel flight={flight()} />);
  expect(screen.queryByRole("img")).toBeNull();
});

test("FLT-08, FLT-09: extra-baggage policy and cancellation tiers are shown", () => {
  // source: spec P-13 "The airline's cancellation policy (tiers)"; FLT-08 extra bags
  render(<FlightDetailsPanel flight={flight()} />);
  expect(screen.getByText("Cancel 14 or more days before departure: 100% refund.")).toBeTruthy();
  expect(screen.getByText(/per extra bag, up to 2 per passenger/)).toBeTruthy();
});

test("Owner texts kept: no tiers and no extra bags", () => {
  // source: team leader 26 Nov "Keep both"
  render(<FlightDetailsPanel flight={flight({ extraBaggage: { extraBagPrice: 0, maxExtraBagsPerPassenger: 0 }, cancellationPolicy: { tiers: [], note: null } })} />);
  expect(screen.getByText("No refund on cancellation.")).toBeTruthy();
  expect(screen.getByText("This airline does not sell extra bags on this flight.")).toBeTruthy();
});
