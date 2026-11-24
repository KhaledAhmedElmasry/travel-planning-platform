// RoundTripSelector (FLT-12 a): round-trip search returns outbound and return options; the user picks
// one of each (spec P-12), which become one booking. Only the callback is faked.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { FlightSearchItem } from "./flight-result-card";
import { RoundTripSelector } from "./round-trip-selector";

afterEach(cleanup);

// source: openapi FlightSearchItem; Mock Data airports CAI and DXB
function flight(id: string, flightNumber: string, from = "CAI", to = "DXB"): FlightSearchItem {
  const airport = (code: string) => ({
    iataCode: code,
    name: `${code} Airport`,
    cityId: code.toLowerCase(),
    countryCode: code === "CAI" ? "EG" : "AE",
    timeZone: code === "CAI" ? "Africa/Cairo" : "Asia/Dubai",
  });
  return {
    id,
    flightNumber,
    airline: { id: "a1", name: "Nile Air", code: "NA", logoUrl: null },
    departureAirport: airport(from),
    arrivalAirport: airport(to),
    departureLocal: "2027-03-01T08:00",
    arrivalLocal: "2027-03-01T13:30",
    departureAt: "2027-03-01T06:00:00.000Z",
    arrivalAt: "2027-03-01T09:30:00.000Z",
    durationMinutes: 210,
    cabins: [
      { cabinId: `${id}-e`, cabinClass: "economy", price: 30000, availableSeats: 9, freeBags: 1, maxBagWeightKg: 23, totalPrice: 30000, currency: "USD" },
    ],
  };
}
const out1 = flight("o1", "NA101");
const out2 = flight("o2", "NA103");
const back1 = flight("r1", "NA102", "DXB", "CAI");

const selectIn = (group: string, flightNumber: string) =>
  fireEvent.click(
    within(within(screen.getByRole("region", { name: group })).getByRole("article", { name: new RegExp(flightNumber) })).getByRole("button", {
      name: /select/i,
    }),
  );

// source: Excel FLT-12 (a) - outbound and return options
test("shows the outbound options and the return options in their own groups", () => {
  render(<RoundTripSelector outbound={[out1, out2]} returns={[back1]} onContinue={vi.fn()} />);

  expect(within(screen.getByRole("region", { name: "Outbound" })).getAllByRole("article")).toHaveLength(2);
  expect(within(screen.getByRole("region", { name: "Return" })).getAllByRole("article")).toHaveLength(1);
});

// source: spec P-12 - "The user picks one of each; they become one booking"
test("Continue needs one outbound and one return choice and hands both over", () => {
  const onContinue = vi.fn();
  render(<RoundTripSelector outbound={[out1, out2]} returns={[back1]} onContinue={onContinue} />);
  const next = screen.getByRole("button", { name: "Continue" });

  expect(next.hasAttribute("disabled")).toBe(true);
  selectIn("Outbound", "NA103");
  expect(next.hasAttribute("disabled")).toBe(true);
  selectIn("Return", "NA102");
  fireEvent.click(next);

  expect(onContinue).toHaveBeenCalledWith({
    outbound: { flight: out2, cabinClass: "economy" },
    return: { flight: back1, cabinClass: "economy" },
  });
});

// source: spec P-12 - one of each: a new outbound choice replaces the previous one
test("choosing another outbound flight replaces the first choice", () => {
  render(<RoundTripSelector outbound={[out1, out2]} returns={[back1]} onContinue={vi.fn()} />);

  selectIn("Outbound", "NA101");
  selectIn("Outbound", "NA103");

  const outbound = screen.getByRole("region", { name: "Outbound" });
  const pressed = within(outbound).getAllByRole("button", { pressed: true });
  expect(pressed).toHaveLength(1);
  expect(within(outbound).getByRole("article", { name: /NA103/ }).contains(pressed[0])).toBe(true);
});

// source: Excel FLT-11 - show "no flights found" when no match exists
test("an empty group says no flights found", () => {
  render(<RoundTripSelector outbound={[out1]} returns={[]} onContinue={vi.fn()} />);

  expect(within(screen.getByRole("region", { name: "Return" })).getByRole("heading", { name: "no flights found" })).toBeDefined();
});
