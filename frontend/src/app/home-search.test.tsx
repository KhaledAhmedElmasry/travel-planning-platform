// Quick flight / hotel search on the public home and the user home (spec section 2).
// Only the router (navigation), browser APIs jsdom lacks and the clock (23 Nov 2026) are faked.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { HomeSearch, searchHref } from "./home-search";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 23, 12, 0, 0));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  router.push.mockReset();
});

// source: Mock Data Airports.csv, Countries.csv, Cities.csv (official ids)
const airports = [
  { iataCode: "CAI", name: "Cairo International Airport", cityId: "cairo", countryCode: "EG", timeZone: "Africa/Cairo" },
  { iataCode: "DXB", name: "Dubai International Airport", cityId: "dubai", countryCode: "AE", timeZone: "Asia/Dubai" },
];
const countries = [{ code: "EG", name: "Egypt", currency: "EGP" }];
const cities = [{ cityId: "cairo", name: "Cairo", countryCode: "EG" }];

// source: frontend/src/components/app/search/flight-search-form.tsx header - pages push /flights?<the exact GET /api/flights/search params>
test("a flight search goes to /flights with exactly the search params, empty ones left out", () => {
  expect(
    searchHref("/flights", {
      tripType: "one_way",
      origin: "CAI",
      destination: "DXB",
      departureDate: "2027-03-01",
      returnDate: undefined,
      adults: 2,
      children: 0,
      infants: 0,
    }),
  ).toBe("/flights?tripType=one_way&origin=CAI&destination=DXB&departureDate=2027-03-01&adults=2&children=0&infants=0");
});

// source: MILESTONE2_FRONTEND_SPEC.md section 2 - flight/hotel search box on the home pages; Excel HTL-11
test("the Hotels tab searches hotels and goes to /hotels with the search params", async () => {
  render(<HomeSearch airports={airports} countries={countries} cities={cities} />);
  expect(screen.getByRole("button", { name: "Search flights" })).toBeTruthy();

  fireEvent.mouseDown(screen.getByRole("tab", { name: "Hotels" }), { button: 0 });
  fireEvent.keyDown(await screen.findByRole("combobox", { name: /^destination/i }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: /^Cairo/ }));
  for (const [label, day] of [
    [/^check-in/i, /November 30th, 2026/],
    [/^check-out/i, /December 3rd, 2026/],
  ] as const) {
    const trigger = screen.getByRole("button", { name: label });
    fireEvent.click(trigger);
    await waitFor(() => {
      const button = screen.queryByRole("button", { name: day });
      if (button) fireEvent.click(button);
      expect(trigger.textContent).not.toContain("Pick a date");
    });
    await waitFor(() => expect(screen.queryByRole("button", { name: day })).toBeNull());
  }
  fireEvent.click(screen.getByRole("button", { name: "Search hotels" }));

  expect(router.push).toHaveBeenCalledWith("/hotels?city=cairo&checkIn=2026-11-30&checkOut=2026-12-03&guests=1&rooms=1");
});
