// P-12 Flight search: results, empty state, choosing a cabin (to P-14), filter, sort and pages keep the search.
// Only the router (navigation) and browser APIs jsdom lacks are faked.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import type { FlightSearchItem } from "@/components/app/search/flight-result-card";
import type { FlightSearchParams } from "@/components/app/search/flight-search-form";
import { FlightFilters, FlightResults, type FlightPage } from "./flight-search";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  router.push.mockReset();
});

// source: Mock Data Airports.csv (official ids + time zones)
const CAI = { iataCode: "CAI", name: "Cairo International Airport", cityId: "cairo", countryCode: "EG", timeZone: "Africa/Cairo" };
const DXB = { iataCode: "DXB", name: "Dubai International Airport", cityId: "dubai", countryCode: "AE", timeZone: "Asia/Dubai" };

const flight = (id: string, number: string, from = CAI, to = DXB): FlightSearchItem => ({
  id,
  flightNumber: number,
  airline: { id: "a1", name: "Demo Air", code: "DA", logoUrl: null },
  departureAirport: from,
  arrivalAirport: to,
  departureLocal: "2027-03-01T10:00:00",
  arrivalLocal: "2027-03-01T15:30:00",
  departureAt: "2027-03-01T08:00:00.000Z",
  arrivalAt: "2027-03-01T11:30:00.000Z",
  durationMinutes: 210,
  cabins: [
    { cabinId: `${id}-e`, cabinClass: "economy", price: 15000, availableSeats: 60, freeBags: 1, maxBagWeightKg: 23, totalPrice: 30000, currency: "USD" },
    { cabinId: `${id}-b`, cabinClass: "business", price: 60000, availableSeats: 12, freeBags: 2, maxBagWeightKg: 32, totalPrice: 120000, currency: "USD" },
  ],
});
const page = (items: FlightSearchItem[], over: Partial<FlightPage> = {}): FlightPage => ({
  items,
  page: 1,
  pageSize: 10,
  total: items.length,
  totalPages: items.length ? 1 : 0,
  ...over,
});

const oneWay: FlightSearchParams = { tripType: "one_way", origin: "CAI", destination: "DXB", departureDate: "2027-03-01", adults: 2, children: 1, infants: 1 };
const roundTrip: FlightSearchParams = { ...oneWay, tripType: "round_trip", returnDate: "2027-03-08" };
const state = (initial: Partial<FlightSearchParams>) => ({ initial, filters: { minPrice: 10000 }, sort: { sortBy: "duration", sortOrder: "asc" as const } });
/** Clicks Select on the cabin row with this label (e.g. "Business") inside scope. */
const selectCabin = (scope: HTMLElement, label: string) => {
  const row = within(scope).getAllByRole("listitem").find((li) => within(li).queryAllByText(label).length > 0);
  fireEvent.click(within(row!).getByRole("button", { name: /select/i }));
};
const pushed = () =>Object.fromEntries(new URL(router.push.mock.calls[0][0] as string, "http://x").searchParams);

// source: Excel FLT-11 show "no flights found" when no match exists; GEN-04 friendly empty state; team leader (26 Nov): both texts
test("a one-way search with no match shows the empty state", () => {
  render(<FlightResults criteria={oneWay} {...state(oneWay)} result={page([])} />);

  expect(screen.getByText("No flights found")).toBeDefined();
  expect(screen.getByText("“Nothing here… try other dates?”")).toBeDefined();
});

// source: Excel FLT-12 (a) round trip; FLT-11 "no flights found"; team leader (26 Nov): both texts
test("a round trip with no outbound and no return flights shows the empty state", () => {
  render(<FlightResults criteria={roundTrip} {...state(roundTrip)} result={{ outbound: page([]), return: page([]) }} />);

  expect(screen.getByText("No flights found")).toBeDefined();
  expect(screen.getByText("“Nothing here… try other dates?”")).toBeDefined();
});

// source: Excel FLT-11 "list ... flights"
test("a one-way search lists every flight found", () => {
  render(<FlightResults criteria={oneWay} {...state(oneWay)} result={page([flight("f1", "DA101"), flight("f2", "DA103")])} />);

  expect(screen.getAllByRole("article").map((a) => within(a).getByRole("heading").textContent)).toEqual(["Demo Air · DA101", "Demo Air · DA103"]);
});

// source: Excel FLT-11 "allow the user to select a flight and cabin category to continue";
// team leader (26 Nov): P-14 URL /flights/{outboundId}/book?cabinClass=&adults=&children=&infants=
test("choosing a cabin of a one-way flight opens booking with the flight, cabin and passengers", () => {
  render(<FlightResults criteria={oneWay} {...state(oneWay)} result={page([flight("f1", "DA101")])} />);

  selectCabin(document.body, "Business");

  expect(router.push).toHaveBeenCalledTimes(1);
  const url = new URL(router.push.mock.calls[0][0] as string, "http://x");
  expect(url.pathname).toBe("/flights/f1/book");
  expect(Object.fromEntries(url.searchParams)).toEqual({ cabinClass: "business", adults: "2", children: "1", infants: "1" });
});

// source: Excel FLT-12 (a) round trip outbound and return booked as one booking;
// team leader (26 Nov): P-14 URL plus returnFlightId=&returnCabinClass=
test("a round trip continues to booking with both flights and cabins", () => {
  render(
    <FlightResults
      criteria={roundTrip}
      {...state(roundTrip)}
      result={{ outbound: page([flight("out1", "DA101")]), return: page([flight("ret1", "DA102", DXB, CAI)]) }}
    />,
  );
  const outbound = screen.getByRole("region", { name: "Outbound" });
  const back = screen.getByRole("region", { name: "Return" });

  selectCabin(outbound, "Economy");
  expect(screen.getByRole("button", { name: "Continue" }).hasAttribute("disabled")).toBe(true);
  selectCabin(back, "Business");
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));

  const url = new URL(router.push.mock.calls[0][0] as string, "http://x");
  expect(url.pathname).toBe("/flights/out1/book");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    cabinClass: "economy",
    adults: "2",
    children: "1",
    infants: "1",
    returnFlightId: "ret1",
    returnCabinClass: "business",
  });
});

// source: Excel GEN-05 page size 10; FLT-15 "preserving the other search criteria"; GEN-14 go back "without losing unrelated data"
test("the page links keep the search, the filter and the sort", () => {
  const ten = Array.from({ length: 10 }, (_, i) => flight(`f${i}`, `DA${100 + i}`));
  render(<FlightResults criteria={oneWay} {...state(oneWay)} result={page(ten, { total: 25, totalPages: 3 })} />);

  const link = screen.getByRole("link", { name: "2" });
  expect(Object.fromEntries(new URL(link.getAttribute("href")!, "http://x").searchParams)).toEqual({
    tripType: "one_way",
    origin: "CAI",
    destination: "DXB",
    departureDate: "2027-03-01",
    adults: "2",
    children: "1",
    infants: "1",
    minPrice: "10000",
    sortBy: "duration",
    sortOrder: "asc",
    page: "2",
  });
});

// source: Excel FLT-15 "sort results by price, duration or departure time" while "preserving the other search criteria"
test("changing the sort keeps the search and the filter and starts again on page 1", async () => {
  render(<FlightResults criteria={oneWay} {...state(oneWay)} result={page([flight("f1", "DA101")])} />);

  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: /^price: high to low/i }));

  expect(pushed()).toEqual({
    tripType: "one_way",
    origin: "CAI",
    destination: "DXB",
    departureDate: "2027-03-01",
    adults: "2",
    children: "1",
    infants: "1",
    minPrice: "10000",
    sortBy: "price",
    sortOrder: "desc",
  });
});

// source: Excel FLT-15 "filter flight results by an inclusive minimum and maximum price while preserving the other search criteria"
test("applying a price filter keeps every search criterion and the sort", () => {
  render(<FlightFilters {...state(roundTrip)} filters={{}} currency="USD" />);

  fireEvent.change(screen.getByRole("spinbutton", { name: /^max price/i }), { target: { value: "500" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));

  expect(pushed()).toEqual({
    tripType: "round_trip",
    origin: "CAI",
    destination: "DXB",
    departureDate: "2027-03-01",
    returnDate: "2027-03-08",
    adults: "2",
    children: "1",
    infants: "1",
    maxPrice: "50000",
    sortBy: "duration",
    sortOrder: "asc",
  });
});
