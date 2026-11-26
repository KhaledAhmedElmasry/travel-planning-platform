// P-12 Flight search: the search criteria in the URL and the query sent to GET /api/flights/search.
// Parameter names and defaults: docs/api/openapi.yaml, GET /api/flights/search.
import { expect, test } from "vitest";
import { parseFlightSearch, searchQuery } from "./search-params";

const params = (query: string) => Object.fromEntries(new URLSearchParams(query));

// source: Excel FLT-11 "selecting a departure airport, arrival airport, departure date and number of passengers";
// openapi: tripType "Defaults to one_way", adults default 1, children default 0, infants default 0
test("a one-way search with airports and date is complete and uses the default passengers", () => {
  const { criteria } = parseFlightSearch(params("origin=CAI&destination=DXB&departureDate=2027-03-01"));

  expect(criteria).toEqual({
    tripType: "one_way",
    origin: "CAI",
    destination: "DXB",
    departureDate: "2027-03-01",
    returnDate: undefined,
    adults: 1,
    children: 0,
    infants: 0,
  });
});

// source: Excel FLT-11 - departure airport, arrival airport and departure date are all needed to search
test.each([
  ["no origin", "destination=DXB&departureDate=2027-03-01"],
  ["no destination", "origin=CAI&departureDate=2027-03-01"],
  ["no departure date", "origin=CAI&destination=DXB"],
  ["nothing", ""],
])("nothing is searched with %s", (_, query) => {
  expect(parseFlightSearch(params(query)).criteria).toBeUndefined();
});

// source: Excel FLT-12 (a) round trip returns outbound and return options; openapi returnDate "Required for round_trip"
test("a round trip without a return date is not searched", () => {
  const { criteria, initial } = parseFlightSearch(params("tripType=round_trip&origin=CAI&destination=DXB&departureDate=2027-03-01"));

  expect(criteria).toBeUndefined();
  expect(initial.tripType).toBe("round_trip");
});

// source: Excel FLT-12 (a) round trip; (b) passenger types adult, child, infant; (c) optional cabin-class filter
test("a round trip keeps the return date, the passenger mix and the cabin", () => {
  const { criteria } = parseFlightSearch(
    params("tripType=round_trip&origin=CAI&destination=DXB&departureDate=2027-03-01&returnDate=2027-03-08&adults=2&children=1&infants=1&cabinClass=business"),
  );

  expect(criteria).toEqual({
    tripType: "round_trip",
    origin: "CAI",
    destination: "DXB",
    departureDate: "2027-03-01",
    returnDate: "2027-03-08",
    adults: 2,
    children: 1,
    infants: 1,
    cabinClass: "business",
  });
});

// source: Excel FLT-15 "filter ... by an inclusive minimum and maximum price while preserving the other search criteria"
test("the price filter is read next to the search criteria", () => {
  const { criteria, filters } = parseFlightSearch(params("origin=CAI&destination=DXB&departureDate=2027-03-01&minPrice=10000&maxPrice=50000"));

  expect(criteria?.origin).toBe("CAI");
  expect(filters).toEqual({ minPrice: 10000, maxPrice: 50000 });
});

// source: Excel FLT-15 "sort results by price, duration or departure time"; openapi sortBy price | duration | departure_time
test.each(["price", "duration", "departure_time"])("sort by %s is kept", (sortBy) => {
  const { sort } = parseFlightSearch(params(`origin=CAI&destination=DXB&departureDate=2027-03-01&sortBy=${sortBy}&sortOrder=desc`));

  expect(sort).toEqual({ sortBy, sortOrder: "desc" });
});

// source: Excel GEN-05 "paginate every list longer than 10 rows"
test("the page number is read from the URL", () => {
  expect(parseFlightSearch(params("origin=CAI&destination=DXB&departureDate=2027-03-01&page=3")).page).toBe(3);
});

// source: Excel FLT-15 "while preserving the other search criteria"; openapi GET /api/flights/search parameter names
test("the query keeps every criterion together with the filter, the sort and the page", () => {
  const query = searchQuery(
    { tripType: "round_trip", origin: "CAI", destination: "DXB", departureDate: "2027-03-01", returnDate: "2027-03-08", adults: 2, children: 1, infants: 1, cabinClass: "economy" },
    { minPrice: 10000, maxPrice: 50000 },
    { sortBy: "duration", sortOrder: "asc" },
    2,
  );

  expect(params(query)).toEqual({
    tripType: "round_trip",
    origin: "CAI",
    destination: "DXB",
    departureDate: "2027-03-01",
    returnDate: "2027-03-08",
    adults: "2",
    children: "1",
    infants: "1",
    cabinClass: "economy",
    minPrice: "10000",
    maxPrice: "50000",
    sortBy: "duration",
    sortOrder: "asc",
    page: "2",
  });
});

// source: openapi returnDate "Required for round_trip" (a one-way search has no return date)
test("a one-way query sends no return date", () => {
  const query = searchQuery(
    { tripType: "one_way", origin: "CAI", destination: "DXB", departureDate: "2027-03-01", returnDate: "2027-03-08", adults: 1, children: 0, infants: 0 },
    {},
    undefined,
    1,
  );

  expect(params(query).returnDate).toBeUndefined();
});

// source: Excel FLT-15 / GEN-14 - the URL round-trips: what is written is read back the same
test("a written query is read back as the same search", () => {
  const criteria = { tripType: "one_way" as const, origin: "CAI", destination: "LHR", departureDate: "2027-03-01", returnDate: undefined, adults: 3, children: 2, infants: 1 };
  const back = parseFlightSearch(params(searchQuery(criteria, { maxPrice: 90000 }, { sortBy: "price", sortOrder: "desc" }, 4)));

  expect(back).toEqual({ criteria, initial: criteria, filters: { maxPrice: 90000 }, sort: { sortBy: "price", sortOrder: "desc" }, page: 4 });
});
