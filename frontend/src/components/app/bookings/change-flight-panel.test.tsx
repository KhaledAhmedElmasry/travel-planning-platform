// ChangeFlightPanel (Bonus FLT-27; spec P-21): pick another date or flight on the same route and
// cabin, see the fare difference, then pay it with Stripe or get the lower fare refunded.
// Faked: fetch (backend), Stripe's React library (external service), the router and the toast.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";

const createPaymentMethod = vi.hoisted(() => vi.fn());
const cardProps = vi.hoisted(() => ({ options: undefined as unknown }));
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: ReactNode }) => children,
  CardElement: (props: { options?: unknown }) => {
    cardProps.options = props.options;
    return <div data-testid="card-element" />;
  },
  useStripe: () => ({ createPaymentMethod }),
  useElements: () => ({ getElement: () => ({ kind: "card" }) }),
}));
vi.mock("@stripe/stripe-js", () => ({ loadStripe: () => Promise.resolve(null) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { ChangeFlightPanel, type ChangeableBooking } from "./change-flight-panel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  createPaymentMethod.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
  router.refresh.mockReset();
});

// source: backend FlightBookingResponse (segments[].fare = cabin price per seat); Mock Data airports CAI, DXB
const booking: ChangeableBooking = {
  id: "fb1",
  currency: "USD",
  segments: [
    { flightId: "f1", flightNumber: "NA101", departureAirport: "CAI", arrivalAirport: "DXB", cabinClass: "economy", fare: 30000 },
    { flightId: "f2", flightNumber: "NA102", departureAirport: "DXB", arrivalAirport: "CAI", cabinClass: "economy", fare: 30000 },
  ],
  passengers: [{ type: "adult" }, { type: "infant" }],
};

const airport = (code: string, timeZone: string) => ({ iataCode: code, name: code, cityId: code, countryCode: "EG", timeZone });
// source: openapi FlightSearchItem (GET /api/flights/search); totalPrice for 1 adult + 1 infant = fare + 10% (FLT-12)
const result = (id: string, flightNumber: string, price: number) => ({
  id,
  flightNumber,
  airline: { id: "a1", name: "Nile Air", code: "NA", logoUrl: null },
  departureAirport: airport("CAI", "Africa/Cairo"),
  arrivalAirport: airport("DXB", "Asia/Dubai"),
  departureLocal: "2027-03-05T08:00",
  arrivalLocal: "2027-03-05T13:30",
  departureAt: "2027-03-05T06:00:00.000Z",
  arrivalAt: "2027-03-05T09:30:00.000Z",
  durationMinutes: 210,
  cabins: [
    { cabinId: `c-${id}`, cabinClass: "economy", price, availableSeats: 9, freeBags: 1, maxBagWeightKg: 23, totalPrice: price + Math.round(price / 10), currency: "USD" },
  ],
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
const searchPage = (items: unknown[]) => json(200, { items, page: 1, pageSize: 10, total: items.length, totalPages: 1 });

async function searchOn(date: string) {
  fireEvent.change(screen.getByLabelText("New date"), { target: { value: date } });
  fireEvent.click(screen.getByRole("button", { name: "Search flights" }));
}

// source: Excel FLT-27 - same route and cabin; spec P-21 - pick another date or flight (reuse the search results UI)
test("searches the same route and cabin on the new date for the booking's passengers, without the current flight", async () => {
  const fetchMock = vi.fn().mockResolvedValue(searchPage([result("f1", "NA101", 30000), result("f9", "NA109", 35000)]));
  vi.stubGlobal("fetch", fetchMock);
  render(<ChangeFlightPanel booking={booking} />);

  await searchOn("2027-03-05");

  await screen.findByRole("heading", { name: "Nile Air · NA109" });
  expect(fetchMock.mock.calls[0][0]).toBe(
    "/api/flights/search?origin=CAI&destination=DXB&departureDate=2027-03-05&adults=1&children=0&infants=1&cabinClass=economy",
  );
  expect(screen.queryByRole("heading", { name: "Nile Air · NA101" })).toBeNull();
});

// source: Excel FLT-27 - change the booking's date or flight; a round trip changes one flight at a time (openapi change-flight)
test("a round trip can change the return flight, searched on the reverse route", async () => {
  const fetchMock = vi.fn().mockResolvedValue(searchPage([]));
  vi.stubGlobal("fetch", fetchMock);
  render(<ChangeFlightPanel booking={booking} />);

  fireEvent.click(screen.getByRole("radio", { name: "Return flight NA102" }));
  await searchOn("2027-03-09");

  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(fetchMock.mock.calls[0][0]).toContain("origin=DXB&destination=CAI&departureDate=2027-03-09");
});

// source: Excel GEN-04 - friendly empty state when a search returns nothing
test("no other flight shows an empty state", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(searchPage([result("f1", "NA101", 30000)])));
  render(<ChangeFlightPanel booking={booking} />);
  await searchOn("2027-03-05");
  expect(await screen.findByRole("heading", { name: "No other flights on this date" })).toBeDefined();
});

// source: Excel FLT-27 - "receiving a refund of a lower fare"; spec P-21 - see the fare difference / see the refund
test("a cheaper flight shows the refund and changes without a card", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(searchPage([result("f9", "NA109", 25000)]))
    .mockResolvedValueOnce(json(200, { id: "fb1", fareChange: { direction: "refunded", amount: 5500, previousTotal: 66000, newTotal: 60500, currency: "USD" } }));
  vi.stubGlobal("fetch", fetchMock);
  render(<ChangeFlightPanel booking={booking} />);
  await searchOn("2027-03-05");
  fireEvent.click(await screen.findByRole("button", { name: /Select/ }));

  // old 30000 + 3000 (infant 10%), new 25000 + 2500: 5500 back
  const summary = screen.getByRole("region", { name: "Fare difference" });
  expect(summary.textContent).toContain("Refund");
  expect(summary.textContent).toContain("$55.00");
  expect(screen.queryByTestId("card-element")).toBeNull();

  fireEvent.click(within(summary).getByRole("button", { name: "Change flight" }));
  await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  expect(fetchMock.mock.calls[1][0]).toBe("/api/flight-bookings/fb1/change-flight");
  expect(fetchMock.mock.calls[1][1].method).toBe("PATCH");
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ segment: "outbound", newFlightId: "f9" });
  expect(toast.success).toHaveBeenCalledWith("Flight changed. $55.00 will be refunded.");
});

// source: Excel FLT-27 - "paying any fare difference via Stripe"; PAY-01 card data goes to Stripe, never to the backend
test("a dearer flight asks for a card, sends Stripe's payment method id and changes", async () => {
  createPaymentMethod.mockResolvedValue({ paymentMethod: { id: "pm_123" } });
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(searchPage([result("f9", "NA109", 40000)]))
    .mockResolvedValueOnce(json(200, { id: "fb1", fareChange: { direction: "charged", amount: 11000, previousTotal: 66000, newTotal: 77000, currency: "USD" } }));
  vi.stubGlobal("fetch", fetchMock);
  render(<ChangeFlightPanel booking={booking} />);
  await searchOn("2027-03-05");
  fireEvent.click(await screen.findByRole("button", { name: /Select/ }));

  const summary = screen.getByRole("region", { name: "Fare difference" });
  expect(summary.textContent).toContain("To pay");
  expect(summary.textContent).toContain("$110.00");
  expect(within(summary).getByTestId("card-element")).toBeDefined();

  fireEvent.click(within(summary).getByRole("button", { name: "Pay and change flight" }));
  await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  expect(createPaymentMethod).toHaveBeenCalledWith({ type: "card", card: { kind: "card" } });
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ segment: "outbound", newFlightId: "f9", paymentMethodId: "pm_123" });
  expect(toast.success).toHaveBeenCalledWith("Flight changed. $110.00 charged.");
});

// source: Excel FLT-27 - "subject to seat availability"; spec P-21 - shows a seat-availability error if needed
test("a refused change shows the backend's message", async () => {
  const message = "The booking is not Confirmed, or the new flight has no seats left in that cabin.";
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValueOnce(searchPage([result("f9", "NA109", 30000)])).mockResolvedValueOnce(json(409, { statusCode: 409, error: "CONFLICT", message })),
  );
  render(<ChangeFlightPanel booking={booking} />);
  await searchOn("2027-03-05");
  fireEvent.click(await screen.findByRole("button", { name: /Select/ }));
  fireEvent.click(within(screen.getByRole("region", { name: "Fare difference" })).getByRole("button", { name: "Change flight" }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
  expect(router.refresh).not.toHaveBeenCalled();
});

// source: PAY-01 - a declined card shows Stripe's error and nothing is sent to the backend
test("a card Stripe refuses shows its message and changes nothing", async () => {
  createPaymentMethod.mockResolvedValue({ error: { message: "Your card number is incomplete." } });
  const fetchMock = vi.fn().mockResolvedValueOnce(searchPage([result("f9", "NA109", 40000)]));
  vi.stubGlobal("fetch", fetchMock);
  render(<ChangeFlightPanel booking={booking} />);
  await searchOn("2027-03-05");
  fireEvent.click(await screen.findByRole("button", { name: /Select/ }));
  fireEvent.click(screen.getByRole("button", { name: "Pay and change flight" }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Your card number is incomplete."));
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

// source: openapi change-flight - a round trip changes one segment at a time (`outbound` or `return`)
test("changing the return flight sends segment return", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(searchPage([result("f8", "NA108", 30000)]))
    .mockResolvedValueOnce(json(200, { id: "fb1", fareChange: { direction: "none", amount: 0, previousTotal: 66000, newTotal: 66000, currency: "USD" } }));
  vi.stubGlobal("fetch", fetchMock);
  render(<ChangeFlightPanel booking={booking} />);
  fireEvent.click(screen.getByRole("radio", { name: "Return flight NA102" }));
  await searchOn("2027-03-09");
  fireEvent.click(await screen.findByRole("button", { name: /Select/ }));
  fireEvent.click(within(screen.getByRole("region", { name: "Fare difference" })).getByRole("button", { name: "Change flight" }));

  await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ segment: "return", newFlightId: "f8" });
  expect(toast.success).toHaveBeenCalledWith("Flight changed.");
});

// source: design-system/yallaway/MASTER.md section 2 (--foreground #E8E7EF, --subtle-foreground #8D8BA0);
// Khaled chose to fix the unreadable card field (popup, 25 Nov 2026).
test("the change-flight card field uses the dark theme's text colors", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(searchPage([result("f9", "NA109", 40000)])));
  render(<ChangeFlightPanel booking={booking} />);
  await searchOn("2027-03-05");
  fireEvent.click(await screen.findByRole("button", { name: /Select/ }));
  await screen.findByTestId("card-element");
  expect(cardProps.options).toEqual({
    style: { base: { color: "#E8E7EF", "::placeholder": { color: "#8D8BA0" } } },
  });
});
