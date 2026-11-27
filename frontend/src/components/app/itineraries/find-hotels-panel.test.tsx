// FindHotelsPanel (ITN-25: pick a city group, enter guests and rooms, see hotels for the
// group's dates, reusing hotel search HTL-11) and its hook-up in ItineraryDays (one panel
// per city group, ITN-09). Faked: fetch (backend), next/navigation and the toast.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams() }));

import { ItineraryDays } from "@/app/my/itineraries/[id]/itinerary-days";
import { FindHotelsPanel } from "./find-hotels-panel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// source: openapi CityGroup fields used by ITN-09; Mock Data UPDATED Cities (cairo, alexandria)
const cairo = {
  cityId: "cairo", firstDay: 1, lastDay: 3, dayCount: 3, dayIds: ["d1", "d2", "d3"],
  startDate: "2027-03-05", endDate: "2027-03-07",
};
const alex = {
  cityId: "alexandria", firstDay: 4, lastDay: 4, dayCount: 1, dayIds: ["d4"],
  startDate: "2027-03-08", endDate: "2027-03-08",
};
// source: openapi HotelSearchResult (HTL-11, HTL-12)
const hotel = (id: string, name: string) => ({
  id, name, cityId: "cairo", countryCode: "EG", starRating: 4, photo: null,
  averageRating: 4.5, ratingCount: 12, pricePerNight: 12000, currency: "USD", freeRooms: 3,
});
// source: openapi ItineraryHotelSearch (PaginatedList + cityId, checkIn = group's first day,
// checkOut = the day after the group's last day, ITN-25)
const results = (items: unknown[]) => ({
  items, page: 1, pageSize: 10, total: items.length, totalPages: 1,
  cityId: "cairo", checkIn: "2027-03-05", checkOut: "2027-03-08",
});

function openPanel(respond: () => Response) {
  const fetchMock = vi.fn<typeof fetch>(async () => respond());
  vi.stubGlobal("fetch", fetchMock);
  render(<FindHotelsPanel itineraryId="it1" group={cairo} cityName="Cairo" />);
  fireEvent.click(screen.getByRole("button", { name: /find hotels/i }));
  return { fetchMock, dialog: screen.getByRole("dialog") };
}
const searchUrl = (fetchMock: ReturnType<typeof vi.fn>) => {
  const [url] = fetchMock.mock.calls[0] as [string];
  return new URL(String(url), "http://localhost");
};

test("the itinerary editor shows one Find hotels action per city group", () => {
  // source: Excel UPDATED ITN-25 "pick a city group in their itinerary"; ITN-09 consecutive days in the same city are a group
  vi.stubGlobal("fetch", vi.fn());
  const days = [
    { id: "d1", number: 1, date: "2027-03-05", cityId: "cairo", notes: "" },
    { id: "d2", number: 2, date: "2027-03-06", cityId: "cairo", notes: "" },
    { id: "d3", number: 3, date: "2027-03-07", cityId: "cairo", notes: "" },
    { id: "d4", number: 4, date: "2027-03-08", cityId: "alexandria", notes: "" },
  ];
  render(
    <ItineraryDays id="it1" days={days} groups={[cairo, alex]} requestedPage={1} transport={[]} bookings={[]}
      currencies={[]} cities={[{ value: "cairo", label: "Cairo" }, { value: "alexandria", label: "Alexandria" }]} />,
  );
  expect(screen.getAllByRole("button", { name: /find hotels/i })).toHaveLength(2);
});

test("searching calls the itinerary hotels endpoint with a day of the group, the guests entered and 1 room by default", async () => {
  // source: Excel UPDATED ITN-25 "a guest count and number of rooms they enter"; HTL-11 "number of rooms (default 1)";
  // PDF section 8 GET /api/itineraries/:id/hotels (ITN-25); openapi query dayId = "any day in the city group", guests, rooms
  const { fetchMock, dialog } = openPanel(() => json(200, results([])));
  fireEvent.click(within(dialog).getByRole("button", { name: "More guests" }));
  fireEvent.click(within(dialog).getByRole("button", { name: /search/i }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const url = searchUrl(fetchMock);
  expect(url.pathname).toBe("/api/itineraries/it1/hotels");
  expect(cairo.dayIds).toContain(url.searchParams.get("dayId"));
  expect(url.searchParams.get("guests")).toBe("2");
  expect(url.searchParams.get("rooms") ?? "1").toBe("1");
  expect(url.searchParams.get("page") ?? "1").toBe("1");
});

test("the number of rooms the user enters is sent", async () => {
  // source: Excel UPDATED ITN-25 "number of rooms they enter"; openapi query rooms
  const { fetchMock, dialog } = openPanel(() => json(200, results([])));
  fireEvent.click(within(dialog).getByRole("button", { name: "More rooms" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "More rooms" }));
  fireEvent.click(within(dialog).getByRole("button", { name: /search/i }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(searchUrl(fetchMock).searchParams.get("rooms")).toBe("3");
  expect(searchUrl(fetchMock).searchParams.get("guests")).toBe("1");
});

test("guests and rooms cannot go below 1", () => {
  // source: openapi GET /api/itineraries/{id}/hotels guests minimum 1, rooms minimum 1 (default 1, HTL-11)
  const { dialog } = openPanel(() => json(200, results([])));
  expect(within(dialog).getByRole<HTMLButtonElement>("button", { name: "Fewer guests" }).disabled).toBe(true);
  expect(within(dialog).getByRole<HTMLButtonElement>("button", { name: "Fewer rooms" }).disabled).toBe(true);
});

test("available hotels are listed and each one opens with the group's check-in and check-out", async () => {
  // source: Excel UPDATED ITN-25 "view hotels available for that group's dates (check-in = date of the group's first day,
  // check-out = the day after its last day)"; HTL-15 view the hotel's free rooms for the searched dates
  const { dialog } = openPanel(() => json(200, results([hotel("h1", "Nile View"), hotel("h2", "Pyramids Inn")])));
  fireEvent.click(within(dialog).getByRole("button", { name: /search/i }));

  expect(await within(dialog).findByText("Nile View")).toBeTruthy();
  expect(within(dialog).getByText("Pyramids Inn")).toBeTruthy();
  const links = within(dialog).getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/hotels/"));
  expect(links.map((a) => new URL(a.getAttribute("href")!, "http://localhost").pathname)).toEqual(["/hotels/h1", "/hotels/h2"]);
  for (const link of links) {
    const href = link.getAttribute("href")!;
    expect(href).toContain("2027-03-05");
    expect(href).toContain("2027-03-08");
  }
});

test("a validation error from the backend is shown next to its field", async () => {
  // source: Excel UPDATED GEN-02 "field-level validation messages on all forms"; openapi Error.fieldErrors [{ field, messages[] }]
  const { dialog } = openPanel(() =>
    json(400, {
      statusCode: 400, error: "BAD_REQUEST", message: "Validation failed",
      fieldErrors: [{ field: "guests", messages: ["guests must not be less than 1"] }],
      path: "/api/itineraries/it1/hotels", timestamp: "2027-03-01T10:00:00.000Z",
    }),
  );
  fireEvent.click(within(dialog).getByRole("button", { name: /search/i }));
  expect(await within(dialog).findByText("guests must not be less than 1")).toBeTruthy();
});

test("a group whose check-in is in the past shows the backend's message and lists no hotels", async () => {
  // source: Excel UPDATED HTL-11 "check-in cannot be in the past" (reused by ITN-25); openapi 400 example message
  const message = "Invalid parameters, or the group's check-in date is in the past.";
  const { dialog } = openPanel(() =>
    json(400, { statusCode: 400, error: "BAD_REQUEST", message, path: "/api/itineraries/it1/hotels", timestamp: "2027-03-01T10:00:00.000Z" }),
  );
  fireEvent.click(within(dialog).getByRole("button", { name: /search/i }));
  expect(await within(dialog).findByText(message)).toBeTruthy();
  expect(within(dialog).queryAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/hotels/"))).toHaveLength(0);
});
