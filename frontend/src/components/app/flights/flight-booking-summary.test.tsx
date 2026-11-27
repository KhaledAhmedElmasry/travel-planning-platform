// P-14 Book a flight (FLT-19, FLT-12, FLT-08, FLT-21, FLT-22, PAY-02): Passengers → Summary (nothing held) →
// Proceed to payment holds the seats → Policies → P-16. Only fetch (the backend), the router and the toast are faked.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { formatCents } from "@/lib/format";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { FlightBookingSummary, type BookingFlight, type PassengerCounts } from "./flight-booking-summary";

const START = "/flights/f1/book?cabinClass=economy&adults=1";
beforeEach(() => {
  Element.prototype.scrollIntoView = () => {};
  window.history.replaceState(null, "", START);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  router.push.mockReset();
});

// source: openapi FlightDetails (GET /api/flights/{id}): cabins with maxBagWeightKg (FLT-04), extraBaggage (FLT-08)
const flight = (id: string, from: string, to: string, departureAt: string): BookingFlight => ({
  id,
  airline: { name: "Nile Air" },
  flightNumber: id === "f1" ? "NA101" : "NA102",
  departureAirport: { iataCode: from, name: from, timeZone: "Africa/Cairo" },
  arrivalAirport: { iataCode: to, name: to, timeZone: "Asia/Dubai" },
  departureLocal: `${departureAt.slice(0, 10)}T10:00:00`,
  departureAt,
  arrivalAt: departureAt.replace("08:00", "12:00"),
  cabins: [{ cabinClass: "economy", price: 20000, maxBagWeightKg: 23 }],
  extraBaggage: { extraBagPrice: 5000, maxExtraBagsPerPassenger: 2 },
  currency: "USD",
});
const outbound = flight("f1", "CAI", "DXB", "2027-03-01T08:00:00.000Z");
const back = flight("f2", "DXB", "CAI", "2027-03-08T08:00:00.000Z");

// source: openapi FlightBookingQuote; Excel FLT-12 infants pay 10% of the fare and take no seat
const quote = {
  passengers: [
    { type: "adult", fullName: "Mona Hassan", fare: 20000, baggageFee: 5000, extraBags: [{ weightKg: 20 }] },
    { type: "infant", fullName: "Omar Hassan", fare: 2000, baggageFee: 0 },
  ],
  seats: 1,
  totalAmount: 27000,
  currency: "USD",
};
// source: openapi BookingPoliciesResponse + FlightBookingPolicies (FLT-08 baggage, FLT-09 tiers)
const policies = {
  bookingType: "flight",
  bookingId: "b1",
  currency: "USD",
  acceptedAt: null,
  policies: {
    bookingType: "flight",
    airline: { id: "a1", name: "Nile Air" },
    cancellationTiers: [{ daysBefore: 7, refundPercentage: 50 }],
    baggage: {
      cabins: [{ flightId: "f1", flightNumber: "NA101", cabinClass: "economy", freeBags: 1, maxBagWeightKg: 23 }],
      extraBagPrice: 5000,
      maxExtraBagsPerPassenger: 2,
    },
  },
};
const held = { id: "b1", holdExpiresAt: "2099-01-01T00:10:00.000Z", totalAmount: 27000, currency: "USD" };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const view = (counts: PassengerCounts = { adults: 1, children: 0, infants: 0 }, flights = [outbound]) =>
  render(<FlightBookingSummary flights={flights} cabins={flights.map(() => "economy")} counts={counts} searchHref="/flights" />);
const currentStep = () => screen.getByRole("listitem", { current: "step" }).textContent;
const card = (name: string) => screen.getByRole("group", { name });
const stepper = (label: string) => screen.getByRole("group", { name: label });
const fill = (name: string, fullName: string, dateOfBirth: string) => {
  const c = card(name);
  fireEvent.change(within(c).getByLabelText(/Full name/), { target: { value: fullName } });
  fireEvent.change(within(c).getByLabelText(/Date of birth/), { target: { value: dateOfBirth } });
  fireEvent.change(within(c).getByLabelText(/Passport or ID number/), { target: { value: "A1234567" } });
};
const continueClick = () => fireEvent.click(screen.getByRole("button", { name: "Continue" }));
const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string);

// ---- Step 1 Passengers ----

// source: Excel FLT-19 "each passenger's" details; FLT-12 (b) passenger types
test("starts on Passengers with one card per passenger, adults then children then infants", () => {
  view({ adults: 2, children: 1, infants: 1 });

  expect(currentStep()).toContain("Passengers");
  expect(screen.getAllByRole("group").filter((g) => g.tagName === "FIELDSET").map((g) => g.querySelector("legend")!.textContent)).toEqual([
    "Adult 1",
    "Adult 2",
    "Child 1",
    "Infant 1",
  ]);
});

// source: Excel FLT-12 (b) "each booking needs at least one adult and no more infants than adults"
test("there is always one adult, and infants cannot go above the adults", () => {
  view({ adults: 1, children: 0, infants: 1 });

  expect(within(stepper("Adults")).getByRole("button", { name: "Fewer adults" })).toHaveProperty("disabled", true);
  expect(within(stepper("Infants")).getByRole("button", { name: "More infants" })).toHaveProperty("disabled", true);
});

// source: Excel FLT-12 (b) "no more infants than adults"
test("removing an adult also removes the extra infant", () => {
  view({ adults: 2, children: 0, infants: 2 });

  fireEvent.click(within(stepper("Adults")).getByRole("button", { name: "Fewer adults" }));

  expect(within(stepper("Infants")).getByText("1")).toBeDefined();
  expect(screen.queryByRole("group", { name: "Infant 2" })).toBeNull();
});

// source: team leader (26 Nov, PR #337): no passenger cap, the sources and the backend set none
test("a tenth passenger can be added", () => {
  view({ adults: 9, children: 0, infants: 0 });

  fireEvent.click(within(stepper("Adults")).getByRole("button", { name: "More adults" }));

  expect(card("Adult 10")).toBeDefined();
});

// source: Excel FLT-19 "extra baggage ... per passenger up to the airline's maximum" (2 here, FLT-08)
test("extra bags stop at the airline's maximum per passenger", () => {
  view();
  const bags = within(card("Adult 1")).getByRole("group", { name: "Extra bags" });

  fireEvent.click(within(bags).getByRole("button", { name: "More extra bags" }));
  fireEvent.click(within(bags).getByRole("button", { name: "More extra bags" }));

  expect(within(bags).getByRole("button", { name: "More extra bags" })).toHaveProperty("disabled", true);
  expect(within(card("Adult 1")).getAllByLabelText(/Bag \d weight/)).toHaveLength(2);
});

// source: Excel FLT-19 required details; openapi POST /api/flight-bookings validates them (nothing is sent when they are missing)
test("Continue with an empty passenger sends nothing and stays on Passengers", () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  view();

  continueClick();

  expect(fetchMock).not.toHaveBeenCalled();
  expect(currentStep()).toContain("Passengers");
  expect(within(card("Adult 1")).getByLabelText(/Full name/).getAttribute("aria-invalid")).toBe("true");
});

// source: openapi Error.fieldErrors (GEN-02) - the backend's field error shows under its field
test("a backend field error shows under that passenger's field", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      json(400, {
        statusCode: 400,
        error: "BAD_REQUEST",
        message: "Validation failed",
        fieldErrors: [{ field: "passengers.0.passportNumber", messages: ["passportNumber must be 1 to 20 characters"] }],
      }),
    ),
  );
  view();
  fill("Adult 1", "Mona Hassan", "1990-01-01");

  continueClick();

  expect(await within(card("Adult 1")).findByText("passportNumber must be 1 to 20 characters")).toBeDefined();
  expect(currentStep()).toContain("Passengers");
});

// ---- Step 2 Summary ----

// source: Excel FLT-21 "booking summary (flight, passengers, baggage, total) before payment";
// openapi POST /api/flight-bookings "Nothing is reserved or saved yet"; FlightBookingRequest {segments, passengers}
test("Continue asks for the summary without holding, then shows the flight, passengers, baggage and total", async () => {
  const fetchMock = vi.fn().mockResolvedValue(json(200, quote));
  vi.stubGlobal("fetch", fetchMock);
  view({ adults: 1, children: 0, infants: 1 });
  fill("Adult 1", "Mona Hassan", "1990-01-01");
  fill("Infant 1", "Omar Hassan", "2026-01-01");
  fireEvent.click(within(card("Adult 1")).getByRole("button", { name: "More extra bags" }));
  fireEvent.change(within(card("Adult 1")).getByLabelText(/Bag 1 weight/), { target: { value: "20" } });

  continueClick();

  await screen.findByRole("button", { name: "Proceed to payment" });
  expect(currentStep()).toContain("Summary");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe("/api/flight-bookings");
  expect(bodyOf(fetchMock.mock.calls[0])).toEqual({
    segments: [{ flightId: "f1", cabinClass: "economy" }],
    passengers: [
      { type: "adult", fullName: "Mona Hassan", dateOfBirth: "1990-01-01", passportNumber: "A1234567", extraBags: [{ weightKg: 20 }] },
      { type: "infant", fullName: "Omar Hassan", dateOfBirth: "2026-01-01", passportNumber: "A1234567" },
    ],
  });
  const page = document.body.textContent!;
  expect(page).toContain("Nile Air NA101");
  expect(page).toContain("Mona Hassan");
  expect(page).toContain("Omar Hassan");
  expect(page).toContain(formatCents(20000, "USD"));
  expect(page).toContain(formatCents(2000, "USD"));
  expect(page).toContain(formatCents(5000, "USD").replace(/\s*USD$/, ""));
  expect(page).toContain(formatCents(27000, "USD"));
});

// source: Excel FLT-12 (a) round trip "booked as one booking with two segments"
test("a round trip sends both flights as two segments", async () => {
  const fetchMock = vi.fn().mockResolvedValue(json(200, quote));
  vi.stubGlobal("fetch", fetchMock);
  view(undefined, [outbound, back]);
  fill("Adult 1", "Mona Hassan", "1990-01-01");

  continueClick();

  await screen.findByRole("button", { name: "Proceed to payment" });
  expect(bodyOf(fetchMock.mock.calls[0]).segments).toEqual([
    { flightId: "f1", cabinClass: "economy" },
    { flightId: "f2", cabinClass: "economy" },
  ]);
});

// ---- Proceed to payment ----

const toSummary = async (fetchMock: ReturnType<typeof vi.fn>) => {
  vi.stubGlobal("fetch", fetchMock);
  view();
  fill("Adult 1", "Mona Hassan", "1990-01-01");
  continueClick();
  await screen.findByRole("button", { name: "Proceed to payment" });
};

// source: Excel FLT-22 "When a user proceeds to payment, the system shall atomically reserve the requested seats";
// PAY-02 policies with an acceptance checkbox before payment; PR #337 (team leader merged): a refresh goes to P-16
test("Proceed to payment holds the seats with the same request, then shows the policies", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(json(200, quote)).mockResolvedValueOnce(json(201, held)).mockResolvedValueOnce(json(200, policies));
  await toSummary(fetchMock);

  fireEvent.click(screen.getByRole("button", { name: "Proceed to payment" }));

  await screen.findByRole("checkbox");
  expect(fetchMock.mock.calls[1][0]).toBe("/api/flight-bookings/hold");
  expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("POST");
  expect(bodyOf(fetchMock.mock.calls[1])).toEqual(bodyOf(fetchMock.mock.calls[0]));
  expect(fetchMock.mock.calls[2][0]).toBe("/api/bookings/flight/b1/policies");
  expect(currentStep()).toContain("Policies");
  expect(new URLSearchParams(window.location.search).get("bookingId")).toBe("b1");
});

// source: Excel FLT-22 "reserve the requested seats only if enough remain"
test("a refused hold shows the backend's message, stays on the Summary and links back to the search", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(json(200, quote))
    .mockResolvedValueOnce(json(409, { statusCode: 409, error: "CONFLICT", message: "Not enough seats left in economy on NA101." }));
  await toSummary(fetchMock);

  fireEvent.click(screen.getByRole("button", { name: "Proceed to payment" }));

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Not enough seats left in economy on NA101.");
  expect(within(alert).getByRole("link", { name: "Back to the search" }).getAttribute("href")).toBe("/flights");
  expect(currentStep()).toContain("Summary");
  expect(new URLSearchParams(window.location.search).get("bookingId")).toBeNull();
});
