// P-27 (ITN-21): the search criteria live in the URL (Dynamic SSR, shareable, back button works),
// and the same query string is sent to GET /api/itineraries/public/search.
import { expect, test } from "vitest";
import { parseItinerarySearch, searchQuery } from "./search-params";

// source: openapi GET /api/itineraries/public/search - keyword, minDays/maxDays (integer >= 1), country, city, page
test("reads the filters and page from the URL, dropping empty and invalid values", () => {
  expect(
    parseItinerarySearch({ keyword: "  nile ", minDays: "3", maxDays: "x", country: "EG", city: "", page: "2" }),
  ).toEqual({ filters: { keyword: "nile", minDays: 3, country: "EG" }, page: 2 });
});

// source: openapi Page parameter (minimum 1); GEN-05
test("a missing, zero or non-integer page is page 1", () => {
  expect(parseItinerarySearch({ page: "0" }).page).toBe(1);
  expect(parseItinerarySearch({ page: "1.5" }).page).toBe(1);
  expect(parseItinerarySearch({}).page).toBe(1);
});

// source: openapi minDays / maxDays "minimum: 1"
test("days below 1 are dropped", () => {
  expect(parseItinerarySearch({ minDays: "0", maxDays: "-2" }).filters).toEqual({});
});

// source: spec P-27 "Paginated results"; FilterPanel keeps only the filled filters (FLT-15 note)
test("builds the query string with the filled filters, page only after page 1", () => {
  expect(searchQuery({ keyword: "nile cruise", minDays: 2, city: "cairo" }, 1)).toBe("keyword=nile+cruise&minDays=2&city=cairo");
  expect(searchQuery({ maxDays: 7 }, 3)).toBe("maxDays=7&page=3");
  expect(searchQuery({}, 1)).toBe("");
});
