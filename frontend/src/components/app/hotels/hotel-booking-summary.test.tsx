// P-19 Book a hotel (HTL-16, HTL-18, HTL-09, PAY-02): Guests per room → Summary (nothing held) → Proceed to payment
// creates the hold → Policies → P-16. Only fetch (the backend), the router and the toast are faked.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { formatCents } from "@/lib/format";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { guestsError, HotelBookingSummary, type AvailableRoom } from "./hotel-booking-summary";

const START = "/hotels/h1/book?checkIn=2027-03-01&checkOut=2027-03-04&roomIds=r101,r201";
beforeEach(() => {
  Element.prototype.scrollIntoView = () => {};
  window.history.replaceState(null, "", START);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  router.push.mockReset();
});

// source: openapi GET /api/hotels/{id} availableRooms (3 nights: 1 to 4 March 2027)
const room = (id: string, roomNumber: string, maxOccupancy: number, pricePerNight: number): AvailableRoom => ({
  id,
  roomNumber,
  type: "double",
  beds: 2,
  maxOccupancy,
  pricePerNight,
  nights: 3,
  totalPrice: pricePerNight * 3,
  currency: "USD",
  checkIn: "2027-03-01",
  checkOut: "2027-03-04",
});
const r101 = room("r101", "101", 2, 10000);
const r201 = room("r201", "201", 3, 15000);
const hotel = { id: "h1", name: "Nile View Hotel", checkInTime: "14:00", checkOutTime: "12:00" };
const hotelHref = "/hotels/h1?checkIn=2027-03-01&checkOut=2027-03-04";

// source: openapi HotelBookingPolicies (HTL-09 times, HTL-10 tiers)
const policies = {
  bookingType: "hotel",
  bookingId: "b1",
  currency: "USD",
  acceptedAt: null,
  policies: { bookingType: "hotel", hotel: { id: "h1", name: "Nile View Hotel" }, cancellationTiers: [{ daysBefore: 3, refundPercentage: 100 }], checkInTime: "14:00", checkOutTime: "12:00" },
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const view = () => render(<HotelBookingSummary hotel={hotel} rooms={[r101, r201]} checkIn="2027-03-01" checkOut="2027-03-04" hotelHref={hotelHref} />);
const currentStep = () => screen.getByRole("listitem", { current: "step" }).textContent;
const toSummary = () => fireEvent.click(screen.getByRole("button", { name: "Continue" }));

// ---- Guests rules ----
const g = (adults: number, childrenAges: number[] = []) => ({ adults, childrenAges });

// source: Excel HTL-16 "assigning adults and children (ages 0-17) to each room, with at least one adult per reservation"
test("one adult for the whole reservation is enough (boundary)", () => {
  expect(guestsError([r101, r201], { r101: g(1), r201: g(0, [5]) })).toBeNull();
});

// source: Excel HTL-16 "at least one adult per reservation"
test("a reservation with no adult is refused", () => {
  expect(guestsError([r101, r201], { r101: g(0, [5]), r201: g(0, [9]) })).toBe("At least one adult is required.");
});

// source: openapi HotelBookingRequest "every room needs at least one guest"; team leader (26 Nov) text
test("a room with no guest is refused", () => {
  expect(guestsError([r101, r201], { r101: g(2), r201: g(0) })).toBe("Each room needs at least one guest.");
});

// source: Excel HTL-16 "No room's guests may exceed its maximum occupancy" (r101 holds 2)
test("a room at its maximum occupancy is accepted and one guest more is refused", () => {
  expect(guestsError([r101], { r101: g(1, [4]) })).toBeNull();
  expect(guestsError([r101], { r101: g(2, [4]) })).toBe("A room has more guests than its maximum occupancy.");
});

// source: Excel HTL-16 "children (ages 0-17)"; team leader (26 Nov) text
test.each([
  ["0", [0], null],
  ["17", [17], null],
  ["18", [18], "Enter each child's age (0 to 17)."],
  ["-1", [-1], "Enter each child's age (0 to 17)."],
  ["empty", [Number.NaN], "Enter each child's age (0 to 17)."],
  ["2.5", [2.5], "Enter each child's age (0 to 17)."],
])("child age %s", (_, ages, expected) => {
  expect(guestsError([r201], { r201: g(1, ages) })).toBe(expected);
});

// ---- Wizard ----

// source: spec P-19 Step 1 Guests per room; Excel HTL-16
test("starts on the Guests step with one section per chosen room", () => {
  view();

  expect(currentStep()).toContain("Guests");
  expect(screen.getByRole("group", { name: "Room 101" })).toBeDefined();
  expect(screen.getByRole("group", { name: "Room 201" })).toBeDefined();
});

// source: Excel HTL-16 at least one adult; spec P-19 order (the Summary comes only after valid guests)
test("Continue with a broken rule shows the error and stays on Guests", () => {
  view();
  const room101 = screen.getByRole("group", { name: "Room 101" });
  fireEvent.click(within(room101).getByRole("button", { name: "More children" }));

  toSummary();

  expect(screen.getByRole("alert").textContent).toBe("Enter each child's age (0 to 17).");
  expect(currentStep()).toContain("Guests");
});

// source: spec P-19 Step 2 Summary: "hotel, rooms, dates, guests, nights × price per room, total, check-in and check-out times (HTL-09)";
// Excel HTL-16 "total price is the sum over rooms of nights x that room's price"; HTL-18 nothing is held before Proceed
test("the Summary shows the hotel, dates, times, each room's nights × price and the total, with nothing held", () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  view();

  toSummary();

  expect(currentStep()).toContain("Summary");
  const step = screen.getByRole("heading", { name: "Nile View Hotel" }).closest("section")!;
  expect(step.textContent).toContain("2027-03-01 to 2027-03-04");
  expect(step.textContent).toContain("Check-in from 14:00; check-out by 12:00.");
  const rows = within(step).getAllByRole("listitem");
  expect(rows[0].textContent).toContain("Room 101");
  expect(rows[0].textContent).toContain("1 adult");
  expect(rows[0].textContent).toContain(`3 nights × ${formatCents(10000, "USD")}`);
  expect(rows[1].textContent).toContain(`3 nights × ${formatCents(15000, "USD")}`);
  expect(step.textContent).toContain(`Total${formatCents(75000, "USD")}`);
  expect(fetchMock).not.toHaveBeenCalled();
});

// source: spec P-19 "Back never loses what was entered" (WizardLayout, team leader Q11); GEN-14
test("Back from the Summary returns to Guests with the guests kept", () => {
  view();
  fireEvent.click(within(screen.getByRole("group", { name: "Room 201" })).getByRole("button", { name: "More adults" }));
  toSummary();

  fireEvent.click(screen.getByRole("button", { name: "Back" }));

  expect(currentStep()).toContain("Guests");
  expect(within(screen.getByRole("group", { name: "Room 201" })).getByRole("group", { name: "Adults" }).textContent).toContain("2");
});

// source: Excel HTL-18 "When a user proceeds to payment, the system shall hold all selected rooms together";
// openapi HotelBookingRequest {hotelId, checkIn, checkOut, rooms[{roomId, adults, childrenAges}]}; PAY-02 policies next
test("Proceed to payment holds all rooms in one request, then shows the policies", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(json(201, { id: "b1", holdExpiresAt: "2099-01-01T00:10:00.000Z", totalAmount: 75000, currency: "USD" })).mockResolvedValueOnce(json(200, policies));
  vi.stubGlobal("fetch", fetchMock);
  view();
  toSummary();

  fireEvent.click(screen.getByRole("button", { name: "Proceed to payment" }));

  await screen.findByRole("checkbox");
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/hotel-bookings");
  expect(init.method).toBe("POST");
  expect(JSON.parse(init.body)).toEqual({
    hotelId: "h1",
    checkIn: "2027-03-01",
    checkOut: "2027-03-04",
    rooms: [
      { roomId: "r101", adults: 1, childrenAges: [] },
      { roomId: "r201", adults: 1, childrenAges: [] },
    ],
  });
  expect(fetchMock.mock.calls[1][0]).toBe("/api/bookings/hotel/b1/policies");
  expect(currentStep()).toContain("Policies");
  // A refresh from here goes to P-16 with this booking instead of holding again.
  expect(window.location.pathname).toBe("/hotels/h1/book");
  expect(Object.fromEntries(new URLSearchParams(window.location.search))).toEqual({ checkIn: "2027-03-01", checkOut: "2027-03-04", roomIds: "r101,r201", bookingId: "b1" });
});

// source: Excel HTL-18 "the whole request is rejected and nothing is held"; spec P-19 "go back to the hotel's rooms"; team leader (26 Nov)
test("a rejected hold shows the backend's message and a link back to the hotel, and stays on the Summary", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(409, { statusCode: 409, error: "CONFLICT", message: "Room 201 is no longer available for these dates." })));
  view();
  toSummary();

  fireEvent.click(screen.getByRole("button", { name: "Proceed to payment" }));

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Room 201 is no longer available for these dates.");
  expect(within(alert).getByRole("link", { name: "Back to the hotel" }).getAttribute("href")).toBe(hotelHref);
  expect(currentStep()).toContain("Summary");
});

// source: Excel HTL-18 one hold per reservation; team leader (26 Nov): "We couldn't load the policies." + Try again reloads only the policies
test("when the policies fail to load, Try again reloads them without a second hold", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(json(201, { id: "b1", holdExpiresAt: "2099-01-01T00:10:00.000Z", totalAmount: 75000, currency: "USD" }))
    .mockResolvedValueOnce(json(500, { statusCode: 500, error: "INTERNAL_SERVER_ERROR", message: "Something went wrong." }))
    .mockResolvedValueOnce(json(200, policies));
  vi.stubGlobal("fetch", fetchMock);
  view();
  toSummary();
  fireEvent.click(screen.getByRole("button", { name: "Proceed to payment" }));

  expect((await screen.findByRole("alert")).textContent).toContain("We couldn't load the policies.");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));

  await screen.findByRole("checkbox");
  expect(fetchMock.mock.calls.map(([u, i]) => `${i?.method ?? "GET"} ${u}`)).toEqual([
    "POST /api/hotel-bookings",
    "GET /api/bookings/hotel/b1/policies",
    "GET /api/bookings/hotel/b1/policies",
  ]);
});

// source: Excel PAY-02 accept the policies before paying; spec P-19 Step 4 Payment (P-16)
test("accepting the policies goes to the payment page of this booking", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(json(201, { id: "b1", holdExpiresAt: "2099-01-01T00:10:00.000Z", totalAmount: 75000, currency: "USD" }))
    .mockResolvedValueOnce(json(200, policies))
    .mockResolvedValueOnce(json(200, { bookingType: "hotel", bookingId: "b1", acceptedAt: "2027-02-01T10:00:00.000Z" }));
  vi.stubGlobal("fetch", fetchMock);
  view();
  toSummary();
  fireEvent.click(screen.getByRole("button", { name: "Proceed to payment" }));

  fireEvent.click(await screen.findByRole("checkbox"));

  await waitFor(() => expect(router.push).toHaveBeenCalledWith("/checkout/hotel/b1"));
});
