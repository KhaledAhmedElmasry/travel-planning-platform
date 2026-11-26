// P-28 404 boundary (GEN-10: "Hidden content is visible only to its author and admins"). P-28 is cached
// for everyone and read WITHOUT cookies, so a hidden itinerary is a 404 there. The 404 boundary asks the
// backend again in the browser, with the session: the author and admins get the itinerary back (shown
// with a "hidden" notice, and admins can unhide it); everyone else keeps the 404.
// Only fetch is faked.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { HiddenItineraryFallback } from "./hidden-itinerary-fallback";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function json(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function backend(routes: Record<string, () => Response>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const r = routes[`${init?.method ?? "GET"} ${url}`];
    if (!r) throw new Error(`unexpected ${init?.method ?? "GET"} ${url}`);
    return r();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const ID = "665f1c2a9b1e8a00123400a1";
const notFound = () => json(404, { statusCode: 404, error: "Not Found", message: "Itinerary not found." });
const page = (items: unknown[]) => () => json(200, { items, page: 1, pageSize: 10, total: items.length, totalPages: 1 });

// source: backend itineraries.service.ts PublicItineraryResponse
const itinerary = {
  id: ID,
  title: "Nile week",
  countryCodes: ["EG"],
  startDate: "2027-03-01",
  visibility: "public",
  author: { id: "a1", name: "Mona Adel" },
  originalAuthor: null,
  days: [{ id: "d1", number: 1, date: "2027-03-01", cityId: "cairo", notes: "", activities: [], budgets: [] }],
  transportCosts: [],
  budget: {
    totalsByCategory: { food: {}, accommodation: {}, in_city_transport: {}, activities: {} },
    intercityTransport: {},
    grandTotal: {},
  },
};

test("a guest (or anyone the backend refuses) keeps the 404 page", async () => {
  backend({ [`GET /api/itineraries/public/${ID}`]: notFound });
  render(<HiddenItineraryFallback itineraryId={ID} />);

  expect(await screen.findByRole("heading", { name: "We can’t find that page" })).toBeTruthy();
  expect(screen.queryByText("Nile week")).toBeNull();
});

test("an admin sees the hidden itinerary with a notice, full names, and can unhide it", async () => {
  backend({
    [`GET /api/itineraries/public/${ID}`]: () => json(200, itinerary),
    "GET /api/countries?page=1": page([{ code: "EG", name: "Egypt" }]),
    "GET /api/cities?page=1": page([{ cityId: "cairo", name: "Cairo", countryCode: "EG" }]),
    "GET /api/auth/me": () => json(200, { id: "ad1", name: "Admin", email: "a@x.io", role: "admin" }),
  });
  render(<HiddenItineraryFallback itineraryId={ID} />);

  expect(await screen.findByRole("heading", { name: "Nile week" })).toBeTruthy();
  expect(screen.getByText("This itinerary is hidden. Only its author and admins can see it.")).toBeTruthy();
  expect(await screen.findByText(/Cairo/)).toBeTruthy();
  expect(await screen.findByRole("button", { name: "Unhide" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "We can’t find that page" })).toBeNull();
});
