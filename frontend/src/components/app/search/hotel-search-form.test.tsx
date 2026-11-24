// HotelSearchForm (HTL-11). Team leader (23 Nov): one Destination list with countries and cities;
// the form hands the exact GET /api/hotels/search params to onSearch; invalid input is prevented.
// Only browser APIs jsdom lacks are stubbed; the clock is fixed to 23 Nov 2026.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { HotelSearchForm, type City, type Country } from "./hotel-search-form";

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
});

// source: Mock Data Countries.csv / Cities.csv (official ids)
const countries: Country[] = [
  { code: "EG", name: "Egypt", currency: "EGP" },
  { code: "AE", name: "United Arab Emirates", currency: "AED" },
];
const cities: City[] = [
  { cityId: "cairo", name: "Cairo", countryCode: "EG" },
  { cityId: "dubai", name: "Dubai", countryCode: "AE" },
];

async function choose(label: RegExp, option: RegExp) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: label }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: option }));
}
async function pickDay(label: RegExp, day: RegExp) {
  const trigger = screen.getByRole("button", { name: label });
  fireEvent.click(trigger);
  // Under load the calendar may not take the first click yet: click until the picker shows a date.
  await waitFor(() => {
    const button = screen.queryByRole("button", { name: day });
    if (button) fireEvent.click(button);
    expect(trigger.textContent).not.toContain("Pick a date");
  });
  await waitFor(() => expect(screen.queryByRole("button", { name: day })).toBeNull());
}
const search = () => screen.getByRole("button", { name: "Search hotels" });

// source: Excel HTL-11 - search by city, check-in, check-out, guests and rooms (default 1)
test("a search by city sends the city id, the dates, the guests and 1 room", async () => {
  const onSearch = vi.fn();
  render(<HotelSearchForm countries={countries} cities={cities} onSearch={onSearch} />);

  await choose(/^destination/i, /^Cairo/);
  await pickDay(/^check-in/i, /November 30th, 2026/);
  await pickDay(/^check-out/i, /December 3rd, 2026/);
  fireEvent.click(search());

  expect(onSearch).toHaveBeenCalledWith({ city: "cairo", checkIn: "2026-11-30", checkOut: "2026-12-03", guests: 1, rooms: 1 });
});

// source: Excel HTL-11 - "by city or country"
test("a search by country sends the country code", async () => {
  const onSearch = vi.fn();
  render(<HotelSearchForm countries={countries} cities={cities} onSearch={onSearch} />);

  await choose(/^destination/i, /^United Arab Emirates/);
  await pickDay(/^check-in/i, /November 30th, 2026/);
  await pickDay(/^check-out/i, /December 1st, 2026/);
  fireEvent.click(search());

  expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ country: "AE" }));
  expect(onSearch.mock.calls[0][0]).not.toHaveProperty("city");
});

// source: Excel HTL-11 - "check-in cannot be in the past"
test("days before today cannot be picked as check-in", async () => {
  render(<HotelSearchForm countries={countries} cities={cities} onSearch={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /^check-in/i }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /November 22nd, 2026/ }).hasAttribute("disabled")).toBe(true),
  );
});

// source: Excel HTL-11 - "Check-out must be after check-in"
test("check-out can only be a day after check-in", async () => {
  render(<HotelSearchForm countries={countries} cities={cities} onSearch={vi.fn()} />);
  await pickDay(/^check-in/i, /November 30th, 2026/);
  fireEvent.click(screen.getByRole("button", { name: /^check-out/i }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /November 30th, 2026/ }).hasAttribute("disabled")).toBe(true),
  );
  expect(screen.getByRole("button", { name: /December 1st, 2026/ }).hasAttribute("disabled")).toBe(false);
});

// source: GEN-16 prevent common input errors; team leader (23 Nov): Search disabled until complete
test("Search stays disabled until destination and both dates are chosen", async () => {
  render(<HotelSearchForm countries={countries} cities={cities} onSearch={vi.fn()} />);
  expect(search().hasAttribute("disabled")).toBe(true);
  await choose(/^destination/i, /^Cairo/);
  await pickDay(/^check-in/i, /November 30th, 2026/);
  expect(search().hasAttribute("disabled")).toBe(true);
  await pickDay(/^check-out/i, /December 2nd, 2026/);
  expect(search().hasAttribute("disabled")).toBe(false);
});

// source: openapi GET /api/hotels/search - guests minimum 1, rooms minimum 1 (default 1)
test("guests and rooms stay at least 1", () => {
  render(<HotelSearchForm countries={countries} cities={cities} onSearch={vi.fn()} />);
  for (const name of ["Guests", "Rooms"]) {
    const group = screen.getByRole("group", { name });
    expect(within(group).getByText("1")).toBeDefined();
    expect(within(group).getByRole("button", { name: /fewer/i }).hasAttribute("disabled")).toBe(true);
  }
});

// source: team leader (23 Nov) - initial values come from props (the search page reads the URL)
test("initial values fill the form", () => {
  render(
    <HotelSearchForm
      countries={countries}
      cities={cities}
      onSearch={vi.fn()}
      initial={{ city: "dubai", checkIn: "2026-12-01", checkOut: "2026-12-04", guests: 3, rooms: 2 }}
    />,
  );
  expect(screen.getByRole("combobox", { name: /^destination/i }).textContent).toContain("Dubai");
  expect(within(screen.getByRole("group", { name: "Guests" })).getByText("3")).toBeDefined();
  expect(within(screen.getByRole("group", { name: "Rooms" })).getByText("2")).toBeDefined();
  expect(search().hasAttribute("disabled")).toBe(false);
});
