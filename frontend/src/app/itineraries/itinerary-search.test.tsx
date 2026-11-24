// P-27 public itinerary search (ITN-21): the filter panel puts the criteria in the URL, the results
// show one card per itinerary (10 per page) or the empty state. Only navigation is faked.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ItineraryResults, ItinerarySearchPanel, type ItineraryPage } from "./itinerary-search";

afterEach(cleanup);

const countries = [{ code: "EG", name: "Egypt", currency: "EGP" }];
const cities = [{ cityId: "cairo", name: "Cairo", countryCode: "EG" }];

// source: Excel ITN-21 "search public itineraries by keyword ... filter by duration (min/max days)"; openapi keyword/minDays
test("Apply sends the keyword and days to the URL of this page", () => {
  const navigate = vi.fn();
  render(<ItinerarySearchPanel initial={{}} countries={countries} cities={cities} navigate={navigate} />);

  fireEvent.change(screen.getByLabelText("Keyword"), { target: { value: "Nile" } });
  fireEvent.change(screen.getByLabelText("Min days"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));

  expect(navigate).toHaveBeenCalledWith("/itineraries?keyword=Nile&minDays=2");
});

// source: FilterPanel "Reset" (team leader 23 Nov); spec P-27
test("Reset goes back to the unfiltered search", () => {
  const navigate = vi.fn();
  render(<ItinerarySearchPanel initial={{ keyword: "Nile" }} countries={countries} cities={cities} navigate={navigate} />);

  fireEvent.click(screen.getByRole("button", { name: "Reset" }));

  expect(navigate).toHaveBeenCalledWith("/itineraries");
});

const summary = (id: string, title: string) => ({
  id,
  title,
  countryCodes: ["EG", "JO"],
  startDate: "2027-03-01",
  numberOfDays: 4,
  visibility: "public" as const,
});

const page = (over: Partial<ItineraryPage> = {}): ItineraryPage => ({
  items: [summary("a1", "Nile week"), summary("b2", "Petra trip")],
  page: 1,
  pageSize: 10,
  total: 2,
  totalPages: 1,
  ...over,
});

// source: Excel ITN-21 "view a public itinerary"; ItineraryCard (full country names, team leader 24 Nov)
test("each result links to its public itinerary page with full country names", () => {
  render(<ItineraryResults data={page()} filters={{}} countryNames={{ EG: "Egypt" }} />);

  const links = screen.getAllByRole("link");
  expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
    ["Nile week", "/itineraries/a1"],
    ["Petra trip", "/itineraries/b2"],
  ]);
  expect(within(screen.getAllByRole("article")[0]).getByText("Egypt, JO")).toBeTruthy();
});

// source: spec P-27 "empty state"; Excel GEN-04
test("no results shows the empty state", () => {
  render(<ItineraryResults data={page({ items: [], total: 0, totalPages: 0 })} filters={{ keyword: "zzz" }} countryNames={{}} />);

  expect(screen.getByText("No itineraries found")).toBeTruthy();
  expect(screen.queryByRole("article")).toBeNull();
});

// source: spec P-27 "Paginated results"; Excel GEN-05 (page size 10)
test("pagination links keep the filters", () => {
  render(<ItineraryResults data={page({ page: 2, total: 25, totalPages: 3 })} filters={{ keyword: "nile", country: "EG" }} countryNames={{}} />);

  expect(screen.getByRole("link", { name: "Next page" }).getAttribute("href")).toBe("/itineraries?keyword=nile&country=EG&page=3");
  expect(screen.getByRole("link", { name: "1" }).getAttribute("href")).toBe("/itineraries?keyword=nile&country=EG");
});
