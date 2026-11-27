// FindFlightsPanel on P-26 (ITN-26: flights from a chosen origin to the city of the itinerary's
// first day, reusing FLT-11 / FLT-12). Faked: fetch (backend), next/navigation and the toast.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { FindFlightsPanel } from "./find-flights-panel";

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// source: Mock Data UPDATED Airports.csv (iata_code, name, city_id, country_code, time_zone)
const airports = [
  { iataCode: "CAI", name: "Cairo International Airport", cityId: "cairo", countryCode: "EG", timeZone: "Africa/Cairo" },
  { iataCode: "DXB", name: "Dubai International Airport", cityId: "dubai", countryCode: "AE", timeZone: "Asia/Dubai" },
  { iataCode: "LHR", name: "Heathrow Airport", cityId: "london", countryCode: "GB", timeZone: "Europe/London" },
];
// source: Mock Data UPDATED Cities.csv (dubai, Dubai)
const dubai = { id: "dubai", name: "Dubai" };

// source: openapi FlightSearchItem
const item = (id: string, flightNumber: string, from = airports[2], to = airports[1]) => ({
  id,
  flightNumber,
  airline: { id: "a1", name: "Nile Air", code: "NA", logoUrl: null },
  departureAirport: from,
  arrivalAirport: to,
  departureLocal: "2027-03-01T08:00",
  arrivalLocal: "2027-03-01T18:00",
  departureAt: "2027-03-01T08:00:00.000Z",
  arrivalAt: "2027-03-01T14:00:00.000Z",
  durationMinutes: 360,
  cabins: [{ cabinId: `${id}-c1`, cabinClass: "economy", price: 30000, availableSeats: 20, freeBags: 1, maxBagWeightKg: 23, totalPrice: 30000, currency: "USD" }],
});
// source: openapi FlightSearchPage (PaginatedList + seatsRequired)
const searchPage = (items: unknown[]) => ({ items, page: 1, pageSize: 10, total: items.length, totalPages: 1, seatsRequired: 1 });

function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>(async () => responses.shift() ?? json(200, searchPage([])));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
/** The query of the n-th GET /api/itineraries/{id}/flights call. */
function query(fetchMock: ReturnType<typeof stubFetch>, n = 0) {
  const url = new URL(String(fetchMock.mock.calls[n][0]), "http://localhost");
  expect(url.pathname).toBe("/api/itineraries/it1/flights");
  return url.searchParams;
}
async function choose(label: RegExp, option: RegExp | string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: label }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: option }));
}

// source: ITN-26 - start date 2027-03-01, last day 2027-03-10 (openapi examples of departureDate / returnDate)
function renderPanel(props: Partial<Parameters<typeof FindFlightsPanel>[0]> = {}) {
  render(<FindFlightsPanel itineraryId="it1" airports={airports} city={dubai} departure="2027-03-01" lastDay="2027-03-10" {...props} />);
}
const searchButton = () => screen.getByRole("button", { name: /search flights/i });

// source: ITN-26 "to any airport in the city of the itinerary's first day"
test("searches towards the first day's city and offers other airports as the origin", async () => {
  stubFetch();
  renderPanel();
  expect(screen.getByText(/Dubai/)).toBeTruthy();
  fireEvent.keyDown(screen.getByRole("combobox", { name: /origin/i }), { key: "Enter" });
  const options = (await screen.findAllByRole("option")).map((option) => option.textContent ?? "");
  expect(options.some((text) => text.includes("LHR"))).toBe(true);
  expect(options.some((text) => text.includes("CAI"))).toBe(true);
});

// source: ITN-26 "one-way ... from a chosen origin airport"; "outbound date defaults to the start date";
// openapi GET /api/itineraries/{id}/flights (origin, tripType, departureDate, adults, children, infants, page)
test("a one-way search sends the chosen origin and the start date as the outbound date", async () => {
  const fetchMock = stubFetch(json(200, searchPage([item("f1", "NA201")])));
  renderPanel();
  await choose(/origin/i, /LHR/);
  fireEvent.click(searchButton());

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const q = query(fetchMock);
  expect(q.get("origin")).toBe("LHR");
  expect(q.get("tripType")).toBe("one_way");
  expect(q.get("departureDate")).toBe("2027-03-01");
  expect(q.get("returnDate")).toBeNull();
  expect(q.get("adults")).toBe("1");
  expect(q.get("children")).toBe("0");
  expect(q.get("infants")).toBe("0");
  expect(q.get("page")).toBe("1");
  expect(q.get("cabinClass")).toBeNull();
  expect(await screen.findByText(/NA201/)).toBeTruthy();
});

// source: ITN-26 "round-trip ... the return date [defaults] to the last day's date"; openapi returnDate
test("a round-trip search sends the last day's date as the return date", async () => {
  const fetchMock = stubFetch();
  renderPanel();
  await choose(/trip type/i, /round trip/i);
  await choose(/origin/i, /LHR/);
  fireEvent.click(searchButton());

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const q = query(fetchMock);
  expect(q.get("tripType")).toBe("round_trip");
  expect(q.get("departureDate")).toBe("2027-03-01");
  expect(q.get("returnDate")).toBe("2027-03-10");
});

// source: FLT-12 (c) "an optional cabin-class filter in search"; openapi CabinClass enum
test("the cabin class is sent only when one is chosen", async () => {
  const fetchMock = stubFetch();
  renderPanel();
  await choose(/origin/i, /LHR/);
  await choose(/^cabin/i, "Business");
  fireEvent.click(searchButton());

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(query(fetchMock).get("cabinClass")).toBe("business");
});

// source: openapi `origin` query parameter is required
test("does not search without an origin airport", async () => {
  const fetchMock = stubFetch();
  renderPanel();
  fireEvent.click(searchButton());
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(fetchMock).not.toHaveBeenCalled();
});

// source: FLT-12 (b) "each booking needs at least one adult and no more infants than adults"
test("keeps at least one adult and no more infants than adults in the search", async () => {
  const fetchMock = stubFetch();
  renderPanel();
  const adults = screen.getByRole("group", { name: "Adults" });
  fireEvent.click(within(adults).getByRole("button", { name: /fewer adults/i }));
  const infants = screen.getByRole("group", { name: "Infants" });
  fireEvent.click(within(infants).getByRole("button", { name: /more infants/i }));
  fireEvent.click(within(infants).getByRole("button", { name: /more infants/i }));
  fireEvent.click(within(screen.getByRole("group", { name: "Children" })).getByRole("button", { name: /more children/i }));
  await choose(/origin/i, /LHR/);
  fireEvent.click(searchButton());

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const q = query(fetchMock);
  expect(q.get("adults")).toBe("1");
  expect(q.get("infants")).toBe("1");
  expect(q.get("children")).toBe("1");
});

// source: FLT-11 'show "no flights found" when no match exists' (reused by ITN-26)
test('shows "no flights found" when nothing matches', async () => {
  stubFetch(json(200, { ...searchPage([]), message: "No flights found" }));
  renderPanel();
  await choose(/origin/i, /LHR/);
  fireEvent.click(searchButton());
  expect(await screen.findByText(/no flights found/i)).toBeTruthy();
});

// source: FLT-11 "allow the user to select a flight and cabin category to continue"
test("selecting a flight's cabin continues to booking that flight", async () => {
  stubFetch(json(200, searchPage([item("f1", "NA201")])));
  renderPanel();
  await choose(/origin/i, /LHR/);
  fireEvent.click(searchButton());
  const card = (await screen.findByText(/NA201/)).closest("article")!;
  fireEvent.click(within(card).getByRole("button", { name: /select\s*economy/i }));
  expect(router.push).toHaveBeenCalledTimes(1);
  expect(String(router.push.mock.calls[0][0])).toContain("f1");
  expect(String(router.push.mock.calls[0][0])).toContain("economy");
});

// source: FLT-12 (a) "round-trip search returning outbound and return options"; openapi RoundTripFlightSearch
test("a round trip shows both the outbound and the return options", async () => {
  stubFetch(json(200, {
    tripType: "round_trip",
    outbound: searchPage([item("f1", "NA201")]),
    return: searchPage([item("f2", "NA202", airports[1], airports[2])]),
  }));
  renderPanel();
  await choose(/trip type/i, /round trip/i);
  await choose(/origin/i, /LHR/);
  fireEvent.click(searchButton());
  expect(await screen.findByText(/NA201/)).toBeTruthy();
  expect(screen.getByText(/NA202/)).toBeTruthy();
});

// source: openapi 400 "Invalid parameters ..." (Error.message shown to the user)
test("shows the backend's message when the search is rejected", async () => {
  stubFetch(json(400, { statusCode: 400, error: "BAD_REQUEST", message: "Invalid parameters, the itinerary has no days, or the first day's city has no airport." }));
  renderPanel();
  await choose(/origin/i, /LHR/);
  fireEvent.click(searchButton());
  expect(await screen.findByText("Invalid parameters, the itinerary has no days, or the first day's city has no airport.")).toBeTruthy();
});

// source: openapi 400 "the itinerary has no days, or the first day's city has no airport" - no search possible
test("offers no search when the itinerary has no days", () => {
  stubFetch();
  renderPanel({ city: undefined, lastDay: undefined });
  expect(screen.queryByRole("button", { name: /search flights/i })).toBeNull();
});

test("offers no search when no airport serves the first day's city", () => {
  stubFetch();
  // source: Mock Data UPDATED Cities.csv (tokyo); no airport of `airports` has city_id tokyo
  renderPanel({ city: { id: "tokyo", name: "Tokyo" } });
  expect(screen.queryByRole("button", { name: /search flights/i })).toBeNull();
});
