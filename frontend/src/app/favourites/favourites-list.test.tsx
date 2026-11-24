// Favourites page (BON-02 bonus): Hotels | Itineraries tabs, 10 per page, Remove asks first (GEN-03)
// then DELETE /api/favourites/{id} (team leader decision 24 Nov - favourites).
// Only fetch, navigation, refresh and the toast are faked.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { FavouritesView, type FavouritePage } from "./favourites-list";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toast.success.mockReset();
  toast.error.mockReset();
});

const hotel = (id: string, name: string) => ({
  id: `f-${id}`,
  type: "hotel" as const,
  targetId: id,
  item: { id, name, cityId: "cairo", countryCode: "EG", starRating: 4, photo: null, averageRating: 4.5, ratingCount: 2 },
});
const itinerary = (id: string, title: string) => ({
  id: `f-${id}`,
  type: "itinerary" as const,
  targetId: id,
  item: { id, title, countryCodes: ["EG"], startDate: "2027-03-01", numberOfDays: 3, visibility: "public" as const },
});
const page = (items: FavouritePage["items"], over: Partial<FavouritePage> = {}): FavouritePage => ({
  items,
  page: 1,
  pageSize: 10,
  total: items.length,
  totalPages: items.length ? 1 : 0,
  ...over,
});
const view = (tab: "hotels" | "itineraries", data: FavouritePage, extra: { navigate?: () => void; refresh?: () => void } = {}) =>
  render(<FavouritesView tab={tab} data={data} countryNames={{ EG: "Egypt" }} cityNames={{ cairo: "Cairo" }} navigate={extra.navigate ?? vi.fn()} refresh={extra.refresh ?? vi.fn()} />);

// source: Excel BON-02 "save hotels ... to a favourites list and view it"; team leader decision 24 Nov - Hotels tab
test("the Hotels tab lists the saved hotels, each linking to its page", () => {
  view("hotels", page([hotel("h1", "Nile View"), hotel("h2", "Sea Breeze")]));

  expect(screen.getByRole("tab", { name: "Hotels" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
    ["Nile View", "/hotels/h1"],
    ["Sea Breeze", "/hotels/h2"],
  ]);
});

// source: Excel BON-02 "public itineraries"; team leader decision 24 Nov - Itineraries tab
test("the Itineraries tab lists the saved itineraries, each linking to its public page", () => {
  view("itineraries", page([itinerary("i1", "Nile week")]));

  expect(screen.getByRole("link", { name: "Nile week" }).getAttribute("href")).toBe("/itineraries/i1");
});

// source: ItineraryCard header + PR #292 - full country names from GET /api/countries (team leader decision 24 Nov);
// team leader answer 24 Nov - full city names on /favourites (GET /api/cities)
test("saved itineraries and hotels show full country and city names", () => {
  view("itineraries", page([itinerary("i1", "Nile week")]));
  expect(screen.getByText("Egypt")).toBeTruthy();
  cleanup();
  view("hotels", page([hotel("h1", "Nile View")]));
  expect(screen.getByText("Cairo, Egypt")).toBeTruthy();
});

// source: team leader decision 24 Nov - "Hotels | Itineraries tabs"
test("choosing the other tab loads its list", () => {
  const navigate = vi.fn();
  view("hotels", page([]), { navigate });

  fireEvent.mouseDown(screen.getByRole("tab", { name: "Itineraries" }), { button: 0 });

  expect(navigate).toHaveBeenCalledWith("/favourites?tab=itineraries");
});

// source: team leader decision 24 Nov - "Remove asks for confirmation first (ConfirmDialog, GEN-03), then DELETE /api/favourites/{id}"
test("Remove asks first, then deletes the favourite and takes it off the list", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  const refresh = vi.fn();
  view("hotels", page([hotel("h1", "Nile View"), hotel("h2", "Sea Breeze")]), { refresh });

  fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole("button", { name: "Remove from favourites" }));

  await waitFor(() => expect(screen.queryByRole("link", { name: "Nile View" })).toBeNull());
  expect(fetchMock).toHaveBeenCalledWith("/api/favourites/f-h1", expect.objectContaining({ method: "DELETE" }));
  expect(toast.success).toHaveBeenCalledWith("Removed from favourites");
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("link", { name: "Sea Breeze" })).toBeTruthy();
});

// source: GEN-03 confirmation: backing out changes nothing
test("going back in the dialog removes nothing", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  view("hotels", page([hotel("h1", "Nile View")]));

  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  fireEvent.click(await screen.findByRole("button", { name: "Go back" }));

  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "Nile View" })).toBeTruthy();
});

// source: openapi DELETE /api/favourites/{id} 404 "Favourite not found for the current user."
test("a failed remove shows the error and keeps the item", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 404, error: "NOT_FOUND", message: "Favourite not found." }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
  view("hotels", page([hotel("h1", "Nile View")]));

  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  fireEvent.click(await screen.findByRole("button", { name: "Remove from favourites" }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Favourite not found."));
  // The dialog stays open (ConfirmDialog), so the page behind it is hidden from the accessibility tree.
  expect(screen.getByRole("link", { name: "Nile View", hidden: true })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Remove from favourites" })).toBeTruthy();
});

// source: Excel GEN-04 friendly empty state
test("an empty tab shows the empty state", () => {
  view("itineraries", page([]));

  expect(screen.getByText("No saved itineraries yet")).toBeTruthy();
});

// source: team leader decision 24 Nov - "10 per page"; Excel GEN-05
test("pagination keeps the tab", () => {
  view("itineraries", page([itinerary("i1", "Nile week")], { page: 1, total: 12, totalPages: 2 }));

  expect(screen.getByRole("link", { name: "Next page" }).getAttribute("href")).toBe("/favourites?tab=itineraries&page=2");
});
