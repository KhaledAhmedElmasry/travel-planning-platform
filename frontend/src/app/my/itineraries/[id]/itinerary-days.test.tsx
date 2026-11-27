// P-26 itinerary editor, days list: add / edit day (ITN-05, max 60 days), city groups (ITN-09),
// move a day (ITN-08). Faked: fetch (backend), next/navigation and the toast.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams() }));

import { ItineraryDays } from "./itinerary-days";

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const ok = () => new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });
function stubFetch() {
  const fetchMock = vi.fn<typeof fetch>(async () => ok());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const writes = (fetchMock: ReturnType<typeof stubFetch>) =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method && init.method !== "GET")
    .map(([url, init]) => ({ url: String(url), method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined }));
async function choose(label: RegExp, option: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: label }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: option }));
}

// source: Mock Data UPDATED Cities.csv (cairo Cairo, dubai Dubai); currency from Countries.csv (EGP)
const cities = [{ value: "cairo", label: "Cairo" }, { value: "dubai", label: "Dubai" }];
const currencies = [{ value: "EGP", label: "EGP" }];
// source: openapi ItineraryDay (id, number, date, cityId, notes)
const day = (n: number, cityId = "cairo") => ({ id: `d${n}`, number: n, date: `2027-03-${String(n).padStart(2, "0")}`, cityId, notes: "" });
const manyDays = (count: number) => Array.from({ length: count }, (_, i) => ({ ...day(1), id: `d${i + 1}`, number: i + 1 }));
// source: openapi CityGroup
const group = (cityId: string, dayIds: string[], firstDay: number, budgetSubtotal?: Record<string, number>) => ({
  cityId, dayIds, firstDay, lastDay: firstDay + dayIds.length - 1, dayCount: dayIds.length,
  startDate: "2027-03-01", endDate: "2027-03-02", budgetSubtotal,
});

function renderDays(days: ReturnType<typeof day>[], groups: ReturnType<typeof group>[]) {
  render(<ItineraryDays id="it1" days={days} groups={groups} cities={cities} currencies={currencies}
    transport={[]} bookings={[]} requestedPage={1} />);
}

test("Add day is offered below 60 days", () => {
  // source: Excel UPDATED ITN-05 "an itinerary has at most 60 days"
  renderDays(manyDays(59), []);
  expect(screen.getByRole("button", { name: "Add day" })).toBeTruthy();
});

test("Add day is not offered when the itinerary already has 60 days", () => {
  // source: Excel UPDATED ITN-05 "an itinerary has at most 60 days"
  renderDays(manyDays(60), []);
  expect(screen.queryByRole("button", { name: "Add day" })).toBeNull();
});

test("adding a day sends the chosen city and notes", async () => {
  // source: Excel UPDATED ITN-05 "add days ... city (selected from the predefined city list) and notes";
  // PDF 8.8 POST /api/itineraries/:id/days (ITN-05); openapi CreateDayRequest {cityId, notes}
  const fetchMock = stubFetch();
  renderDays([], []);
  fireEvent.click(screen.getByRole("button", { name: "Add day" }));
  const dialog = await screen.findByRole("dialog");
  await choose(/^City/, "Cairo");
  fireEvent.change(within(dialog).getByLabelText(/^Notes/), { target: { value: "Arrive in the afternoon and rest." } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

  await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  expect(writes(fetchMock)).toEqual([
    { url: "/api/itineraries/it1/days", method: "POST", body: { cityId: "cairo", notes: "Arrive in the afternoon and rest." } },
  ]);
});

test("editing a day sends PATCH with the new city", async () => {
  // source: Excel UPDATED ITN-05 "edit each day's city ... and notes"; PDF 8.8 PATCH /api/itineraries/:id/days/:dayId (ITN-05);
  // openapi UpdateDayRequest {cityId, notes}
  const fetchMock = stubFetch();
  renderDays([day(1)], [group("cairo", ["d1"], 1)]);
  fireEvent.click(screen.getByRole("button", { name: "Edit day" }));
  const dialog = await screen.findByRole("dialog");
  await choose(/^City/, "Dubai");
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

  await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  const sent = writes(fetchMock);
  expect(sent.map(({ url, method }) => [url, method])).toEqual([["/api/itineraries/it1/days/d1", "PATCH"]]);
  expect(sent[0].body.cityId).toBe("dubai");
});

test("consecutive days in the same city are shown as one group with its day count and budget subtotal", () => {
  // source: Excel UPDATED ITN-09 "display consecutive days in the same city as a group, with the group's day count and budget subtotal";
  // openapi CityGroup (dayIds, dayCount, budgetSubtotal)
  renderDays([day(1), day(2), day(3, "dubai")], [group("cairo", ["d1", "d2"], 1, { EGP: 150 }), group("dubai", ["d3"], 3)]);

  const cairo = screen.getByRole("heading", { name: "Cairo" }).closest("section")!;
  const cairoHeader = screen.getByRole("heading", { name: "Cairo" }).closest("header")!;
  expect(within(cairoHeader).getByText("2 days")).toBeTruthy();
  expect(within(cairoHeader).getByText(/EGP\s150\.00/)).toBeTruthy();
  // each day card carries its own "Move day N up" control: it tells which days sit in the group
  expect(within(cairo).getByRole("button", { name: "Move day 1 up" })).toBeTruthy();
  expect(within(cairo).getByRole("button", { name: "Move day 2 up" })).toBeTruthy();
  expect(within(cairo).queryByRole("button", { name: "Move day 3 up" })).toBeNull();

  const dubai = screen.getByRole("heading", { name: "Dubai" }).closest("section")!;
  expect(within(dubai.querySelector("header")!).getByText("1 day")).toBeTruthy();
  expect(within(dubai).getByRole("button", { name: "Move day 3 up" })).toBeTruthy();
});

test("moving a day up or down sends the day and its new position", async () => {
  // source: Excel UPDATED ITN-08 "move a day to a new position"; PDF 8.8 PATCH /api/itineraries/:id/days/reorder (ITN-08);
  // openapi ReorderDaysRequest {dayId, position} "The new day number (1 = first day)"
  const fetchMock = stubFetch();
  renderDays([day(1), day(2), day(3)], [group("cairo", ["d1", "d2", "d3"], 1)]);

  fireEvent.click(screen.getByRole("button", { name: "Move day 2 up" }));
  await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "Move day 2 down" }));
  await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(2));

  expect(writes(fetchMock)).toEqual([
    { url: "/api/itineraries/it1/days/reorder", method: "PATCH", body: { dayId: "d2", position: 1 } },
    { url: "/api/itineraries/it1/days/reorder", method: "PATCH", body: { dayId: "d2", position: 3 } },
  ]);
});

test("the first day cannot move up and the last day cannot move down", () => {
  // source: openapi ReorderDaysRequest 400 "The position is outside 1 to the number of days."
  renderDays([day(1), day(2)], [group("cairo", ["d1", "d2"], 1)]);
  expect((screen.getByRole("button", { name: "Move day 1 up" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Move day 2 down" }) as HTMLButtonElement).disabled).toBe(true);
});
