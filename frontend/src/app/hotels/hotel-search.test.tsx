// P-15 Hotel search: results with place names, card link to P-18, empty state, loading state, and
// filter, sort and pages keep the search. Only the router (navigation) and browser APIs jsdom lacks are faked.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import type { HotelSearchResult } from "@/components/app/search/hotel-result-card";
import type { HotelSearchParams } from "@/components/app/search/hotel-search-form";
import { HotelFilters, HotelResults } from "./hotel-search";
import Loading from "./loading";

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

// source: openapi HotelSearchResult (GET /api/hotels/search 200 example)
const hotel = (id: string, name: string): HotelSearchResult => ({
  id,
  name,
  cityId: "cairo",
  countryCode: "EG",
  starRating: 5,
  photo: null,
  averageRating: 4.5,
  ratingCount: 12,
  pricePerNight: 15000,
  currency: "USD",
  freeRooms: 2,
});
type HotelPage = { items: HotelSearchResult[]; page: number; pageSize: number; total: number; totalPages: number };
const page = (items: HotelSearchResult[], over: Partial<HotelPage> = {}): HotelPage => ({
  items,
  page: 1,
  pageSize: 10,
  total: items.length,
  totalPages: items.length ? 1 : 0,
  ...over,
});

// source: openapi GET /api/hotels/search query names (city, checkIn, checkOut, guests, rooms, minPrice, sortBy, sortOrder)
const search: HotelSearchParams = { city: "cairo", checkIn: "2027-03-01", checkOut: "2027-03-05", guests: 3, rooms: 2 };
const state = { initial: search, filters: { minPrice: 5000 }, sort: { sortBy: "rating", sortOrder: "desc" as const } };
// source: Mock Data Cities.csv / Countries.csv official ids and names
const cityNames = { cairo: "Cairo" };
const countryNames = { EG: "Egypt" };
const searchAndSort = { city: "cairo", checkIn: "2027-03-01", checkOut: "2027-03-05", guests: "3", rooms: "2", sortBy: "rating", sortOrder: "desc" };
const searchAndFilterAndSort = { ...searchAndSort, minPrice: "5000" };
const pushed = () => Object.fromEntries(new URL(router.push.mock.calls[0][0] as string, "http://x").searchParams);

// source: handout-T2 GEN-04 `<EmptyState pose="shrug" line="Nothing here… try other dates?" … />`; Excel GEN-04
test("a search with no hotels shows So3ad's empty-state line", () => {
  render(<HotelResults result={page([])} state={state} cityNames={cityNames} countryNames={countryNames} />);

  expect(screen.getByText("“Nothing here… try other dates?”")).toBeDefined();
  expect(screen.queryAllByRole("article")).toHaveLength(0);
});

// source: handout-T2 GEN-16 "While hotel search results load: `<SearchLoading />`"; spec §5.1 "Hold on, I'm haggling for you…"
test("the loading state is So3ad's search line", () => {
  render(<Loading />);

  expect(screen.getByRole("status").textContent).toBe("“Hold on, I’m haggling for you…”");
});

// source: Excel HTL-11 "list active hotels"; spec P-15 result card "city and country";
// HotelResultCard header (team leader 23 Nov): the page passes the place names from GET /api/cities and /api/countries
test("every hotel found is listed with its city and country names", () => {
  render(<HotelResults result={page([hotel("h1", "Nile View"), hotel("h2", "Pyramids Inn")])} state={state} cityNames={cityNames} countryNames={countryNames} />);

  const cards = screen.getAllByRole("article");
  expect(cards.map((a) => within(a).getByRole("heading").textContent)).toEqual(["Nile View", "Pyramids Inn"]);
  expect(within(cards[0]).getByText("Cairo, Egypt")).toBeDefined();
});

// source: HotelResultCard header (team leader 23 Nov): the card links to /hotels/{id} with the searched dates, guests and rooms
test("a hotel card opens the hotel with the searched dates, guests and rooms", () => {
  render(<HotelResults result={page([hotel("h1", "Nile View")])} state={state} cityNames={cityNames} countryNames={countryNames} />);

  const url = new URL(screen.getByRole("link", { name: "Nile View" }).getAttribute("href")!, "http://x");
  expect(url.pathname).toBe("/hotels/h1");
  expect(Object.fromEntries(url.searchParams)).toEqual({ checkIn: "2027-03-01", checkOut: "2027-03-05", guests: "3", rooms: "2" });
});

// source: Excel GEN-05 page size 10; openapi Page parameter; GEN-14 go back "without losing unrelated data"
test("the page links keep the search, the filter and the sort", () => {
  const ten = Array.from({ length: 10 }, (_, i) => hotel(`h${i}`, `Hotel ${i}`));
  render(<HotelResults result={page(ten, { total: 25, totalPages: 3 })} state={state} cityNames={cityNames} countryNames={countryNames} />);

  const link = screen.getByRole("link", { name: "2" });
  expect(Object.fromEntries(new URL(link.getAttribute("href")!, "http://x").searchParams)).toEqual({ ...searchAndFilterAndSort, page: "2" });
});

// source: Excel HTL-12 "sort the results by that price or by rating"; FilterPanel/SortSelect headers: the page keeps every other criterion
test("sorting by price keeps the search and the filter", async () => {
  render(<HotelResults result={page([hotel("h1", "Nile View")])} state={state} cityNames={cityNames} countryNames={countryNames} />);

  fireEvent.keyDown(screen.getByRole("combobox", { name: "Sort by" }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: "Price: high to low" }));

  expect(pushed()).toMatchObject({ ...searchAndFilterAndSort, sortBy: "price", sortOrder: "desc" });
});

// source: Excel HTL-12 inclusive min and max price per night; FilterPanel header: whole amounts sent in cents (openapi minPrice/maxPrice)
test("applying a max price sends cents and keeps the search and the sort", () => {
  render(<HotelFilters state={{ ...state, filters: {} }} currency="USD" />);

  fireEvent.change(screen.getAllByRole("spinbutton", { name: /^max price/i })[0], { target: { value: "250" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Apply" })[0]);

  expect(pushed()).toEqual({ ...searchAndSort, maxPrice: "25000" });
});

// source: Excel HTL-12 "minimum average rating (1-5)"; openapi minRating
test("applying a minimum rating keeps the search and the sort", async () => {
  render(<HotelFilters state={{ ...state, filters: {} }} currency="USD" />);

  fireEvent.keyDown(screen.getAllByRole("combobox", { name: "Minimum rating" })[0], { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: "4 or more" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Apply" })[0]);

  expect(pushed()).toEqual({ ...searchAndSort, minRating: "4" });
});
