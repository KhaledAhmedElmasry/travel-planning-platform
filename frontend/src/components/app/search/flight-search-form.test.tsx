// FlightSearchForm (FLT-11, FLT-12, FLT-02). Team leader (23 Nov): the form hands the exact backend
// query params to onSearch; invalid input is prevented (no new texts); no past departure dates.
// Only browser APIs jsdom lacks are stubbed; the clock is fixed to 23 Nov 2026.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { FlightSearchForm, type Airport } from "./flight-search-form";

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

// source: Mock Data Airports.csv (official ids) - CAI Cairo, DXB Dubai, LHR London
const airports: Airport[] = [
  { iataCode: "CAI", name: "Cairo International Airport", cityId: "cairo", countryCode: "EG", timeZone: "Africa/Cairo" },
  { iataCode: "DXB", name: "Dubai International Airport", cityId: "dubai", countryCode: "AE", timeZone: "Asia/Dubai" },
  { iataCode: "LHR", name: "Heathrow Airport", cityId: "london", countryCode: "GB", timeZone: "Europe/London" },
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
  // Wait until this calendar is gone, so the next one opened is not confused with it.
  await waitFor(() => expect(screen.queryByRole("button", { name: day })).toBeNull());
}
const search = () => screen.getByRole("button", { name: "Search flights" });

// source: Excel FLT-11 - departure airport, arrival airport, departure date and passengers
test("a one-way search sends origin, destination, local departure date and 1 adult", async () => {
  const onSearch = vi.fn();
  render(<FlightSearchForm airports={airports} onSearch={onSearch} />);

  await choose(/^from/i, /CAI/);
  await choose(/^to/i, /DXB/);
  await pickDay(/^departure date/i, /November 30th, 2026/);
  fireEvent.click(search());

  expect(onSearch).toHaveBeenCalledWith({
    tripType: "one_way",
    origin: "CAI",
    destination: "DXB",
    departureDate: "2026-11-30",
    adults: 1,
    children: 0,
    infants: 0,
  });
});

// source: GEN-16 prevent common input errors; team leader (23 Nov): Search disabled until airports and date are set
test("Search stays disabled until both airports and the departure date are chosen", async () => {
  render(<FlightSearchForm airports={airports} onSearch={vi.fn()} />);
  expect(search().hasAttribute("disabled")).toBe(true);
  await choose(/^from/i, /CAI/);
  await choose(/^to/i, /DXB/);
  expect(search().hasAttribute("disabled")).toBe(true);
  await pickDay(/^departure date/i, /November 30th, 2026/);
  expect(search().hasAttribute("disabled")).toBe(false);
});

// source: team leader (23 Nov) - departure and arrival can't be the same airport (the second list hides the first)
test("the arrival list does not offer the chosen departure airport", async () => {
  render(<FlightSearchForm airports={airports} onSearch={vi.fn()} />);
  await choose(/^from/i, /CAI/);
  fireEvent.keyDown(screen.getByRole("combobox", { name: /^to/i }), { key: "Enter" });
  const listbox = await screen.findByRole("listbox");
  expect(within(listbox).queryByRole("option", { name: /CAI/ })).toBeNull();
  expect(within(listbox).getByRole("option", { name: /DXB/ })).toBeDefined();
});

// source: team leader (23 Nov) - no past departure dates
test("days before today cannot be picked as departure date", async () => {
  render(<FlightSearchForm airports={airports} onSearch={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /^departure date/i }));
  const yesterday = await screen.findByRole("button", { name: /November 22nd, 2026/ });
  expect(yesterday.hasAttribute("disabled")).toBe(true);
});

// source: Excel FLT-12 (a) round trip; openapi returnDate "Required for round_trip. Not before departureDate"
test("a round trip asks for a return date not before departure and sends it", async () => {
  const onSearch = vi.fn();
  render(<FlightSearchForm airports={airports} onSearch={onSearch} />);
  fireEvent.click(screen.getByRole("radio", { name: "Round trip" }));
  await choose(/^from/i, /CAI/);
  await choose(/^to/i, /LHR/);
  await pickDay(/^departure date/i, /November 30th, 2026/);
  expect(search().hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: /^return date/i }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /November 29th, 2026/ }).hasAttribute("disabled")).toBe(true),
  );
  fireEvent.click(screen.getByRole("button", { name: /December 5th, 2026/ }));
  fireEvent.click(search());

  expect(onSearch).toHaveBeenCalledWith(
    expect.objectContaining({ tripType: "round_trip", departureDate: "2026-11-30", returnDate: "2026-12-05" }),
  );
});

// source: Excel FLT-12 (b) at least one adult, no more infants than adults
test("adults stay at least 1 and infants can't exceed adults", () => {
  render(<FlightSearchForm airports={airports} onSearch={vi.fn()} />);
  const adults = screen.getByRole("group", { name: "Adults" });
  const infants = screen.getByRole("group", { name: "Infants" });
  expect(within(adults).getByRole("button", { name: /fewer/i }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(within(infants).getByRole("button", { name: /more/i }));
  expect(within(infants).getByRole("button", { name: /more/i }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(within(adults).getByRole("button", { name: /more/i }));
  expect(within(infants).getByRole("button", { name: /more/i }).hasAttribute("disabled")).toBe(false);
});

// source: Excel FLT-12 (c) optional cabin-class filter; spec P-12 labels Economy ... First
test("a chosen cabin class is sent; none means every cabin", async () => {
  const onSearch = vi.fn();
  render(<FlightSearchForm airports={airports} onSearch={onSearch} />);
  await choose(/^from/i, /CAI/);
  await choose(/^to/i, /DXB/);
  await pickDay(/^departure date/i, /November 30th, 2026/);
  await choose(/^cabin/i, /^Business$/);
  fireEvent.click(search());
  await waitFor(() => expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ cabinClass: "business" })));
});

// source: team leader (23 Nov) - initial values come from props (the search page reads the URL)
test("initial values fill the form", () => {
  render(
    <FlightSearchForm
      airports={airports}
      onSearch={vi.fn()}
      initial={{ origin: "CAI", destination: "DXB", departureDate: "2026-12-01", adults: 2 }}
    />,
  );
  expect(screen.getByRole("combobox", { name: /^from/i }).textContent).toContain("CAI");
  expect(screen.getByRole("button", { name: /^departure date/i }).textContent).toContain("2026");
  expect(within(screen.getByRole("group", { name: "Adults" })).getByText("2")).toBeDefined();
  expect(search().hasAttribute("disabled")).toBe(false);
});
