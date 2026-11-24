// FlightResultCard (FLT-11, GEN-06). Team leader (23 Nov): one row per matching cabin with its own
// Select button; each row shows the total for the searched passengers and the fare per person.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { FlightResultCard, type FlightSearchItem } from "./flight-result-card";

afterEach(cleanup);

// source: openapi FlightSearchItem (GET /api/flights/search), Mock Data airports CAI (Africa/Cairo) and DXB (Asia/Dubai)
const flight: FlightSearchItem = {
  id: "665f1c2a9b1e8a00123400a1",
  flightNumber: "NA101",
  airline: { id: "a1", name: "Nile Air", code: "NA", logoUrl: null },
  departureAirport: { iataCode: "CAI", name: "Cairo International Airport", cityId: "cairo", countryCode: "EG", timeZone: "Africa/Cairo" },
  arrivalAirport: { iataCode: "DXB", name: "Dubai International Airport", cityId: "dubai", countryCode: "AE", timeZone: "Asia/Dubai" },
  departureLocal: "2027-03-01T08:00",
  arrivalLocal: "2027-03-01T13:30",
  departureAt: "2027-03-01T06:00:00.000Z",
  arrivalAt: "2027-03-01T09:30:00.000Z",
  durationMinutes: 210,
  cabins: [
    { cabinId: "c1", cabinClass: "economy", price: 30000, availableSeats: 12, freeBags: 1, maxBagWeightKg: 23, totalPrice: 63000, currency: "USD" },
    { cabinId: "c2", cabinClass: "business", price: 90000, availableSeats: 2, freeBags: 2, maxBagWeightKg: 32, totalPrice: 189000, currency: "USD" },
  ],
};

// source: Excel FLT-11 + spec P-12 - airline, flight number, local times, duration; GEN-06 local time zones
test("shows the airline, flight number, both airports with their local times and the duration", () => {
  render(<FlightResultCard flight={flight} onSelect={vi.fn()} />);

  const card = screen.getByRole("article", { name: /NA101/ });
  expect(card.textContent).toContain("Nile Air");
  expect(card.textContent).toContain("CAI");
  expect(card.textContent).toContain("DXB");
  expect(card.textContent).toContain("08:00");
  expect(card.textContent).toContain("13:30");
  expect(card.textContent).toContain("3h 30m");
});

// source: Excel FLT-11 "select a flight and cabin category"; team leader (23 Nov): total + fare per person per cabin
test("lists each cabin with the total, the fare per person and the seats left", () => {
  render(<FlightResultCard flight={flight} onSelect={vi.fn()} />);

  const rows = screen.getAllByRole("listitem");
  expect(rows).toHaveLength(2);
  expect(rows[0].textContent).toContain("Economy");
  expect(rows[0].textContent).toContain("630.00");
  expect(rows[0].textContent).toContain("300.00");
  expect(rows[0].textContent).toContain("per person");
  expect(rows[0].textContent).toContain("12 seats left");
  expect(rows[1].textContent).toContain("Business");
  expect(rows[1].textContent).toContain("2 seats left");
});

// source: Excel FLT-11 - "allow the user to select a flight and cabin category to continue"
test("Select on a cabin row hands over the flight and that cabin", () => {
  const onSelect = vi.fn();
  render(<FlightResultCard flight={flight} onSelect={onSelect} />);

  fireEvent.click(within(screen.getAllByRole("listitem")[1]).getByRole("button", { name: /select/i }));

  expect(onSelect).toHaveBeenCalledWith(flight, "business");
});

// source: Excel FLT-12 (a) the user picks one outbound and one return option: the chosen cabin is shown as selected
test("the selected cabin is marked as pressed", () => {
  render(<FlightResultCard flight={flight} onSelect={vi.fn()} selectedCabin="economy" />);

  const [economy, business] = screen.getAllByRole("listitem");
  expect(within(economy).getByRole("button").getAttribute("aria-pressed")).toBe("true");
  expect(within(business).getByRole("button").getAttribute("aria-pressed")).toBe("false");
});
