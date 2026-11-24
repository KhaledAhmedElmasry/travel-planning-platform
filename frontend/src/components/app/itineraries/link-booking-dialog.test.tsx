// LinkBookingDialog + UnlinkBookingButton (Bonus ITN-27; spec P-26 "a picker of the user's
// Confirmed flight and hotel bookings"). Faked: fetch (backend) and the toast.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { LinkBookingDialog, UnlinkBookingButton } from "./link-booking-dialog";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toast.success.mockReset();
  toast.error.mockReset();
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const page = (items: unknown[], pageNo = 1, totalPages = 1) =>
  json(200, { items, page: pageNo, pageSize: 10, total: items.length, totalPages });

// source: openapi FlightBookingListItem (GET /api/flight-bookings?group=upcoming); Mock Data airports CAI, DXB
const flight = (id: string, status = "confirmed", flightNumber = "NA101") => ({
  id,
  reference: status === "confirmed" ? `REF${id}` : null,
  status,
  flightNumber,
  departureAirport: "CAI",
  arrivalAirport: "DXB",
  departureAt: "2027-03-05T06:00:00.000Z",
  departureLocal: "2027-03-05T08:00",
  passengers: 2,
  cabinClass: "economy",
  holdExpiresAt: status === "pending_payment" ? "2027-03-01T10:10:00.000Z" : null,
});
// source: openapi HotelBookingListItem (GET /api/hotel-bookings?group=upcoming)
const hotel = (id: string, status = "confirmed") => ({
  id,
  reference: `H${id}`,
  status,
  hotel: { id: "h1", name: "Nile View" },
  rooms: [{ roomId: "r1", roomNumber: "101", type: "double" }],
  checkIn: "2027-03-05",
  checkOut: "2027-03-08",
  guests: { adults: 2, children: 0 },
  totalAmount: 45000,
  currency: "USD",
  holdExpiresAt: null,
});
// source: openapi LinkedBooking (201 of POST /api/itineraries/{id}/bookings)
const linked = {
  id: "l1",
  bookingType: "flight",
  bookingId: "f1",
  dayId: "d2",
  reference: "REFf1",
  description: "Flight NA101 CAI-DXB",
  amount: 600,
  currency: "USD",
  status: "confirmed",
};

/** Answers GET /api/{flight|hotel}-bookings?group=upcoming|past by list; POST / DELETE with `write`. */
function backend(
  lists: { flights?: Response[]; hotels?: Response[]; pastFlights?: Response[]; pastHotels?: Response[] },
  write?: Response,
) {
  const queues: Record<string, Response[]> = {
    "flight-upcoming": [...(lists.flights ?? [])],
    "hotel-upcoming": [...(lists.hotels ?? [])],
    "flight-past": [...(lists.pastFlights ?? [])],
    "hotel-past": [...(lists.pastHotels ?? [])],
  };
  return vi.fn((path: string, init?: RequestInit) => {
    if (init?.method && init.method !== "GET") return Promise.resolve(write ?? json(500, {}));
    const match = /^\/api\/(flight|hotel)-bookings\?group=(upcoming|past)&page=\d+$/.exec(path);
    if (!match) return Promise.resolve(json(404, {}));
    return Promise.resolve(queues[`${match[1]}-${match[2]}`].shift() ?? page([]));
  });
}

function open(props: Partial<Parameters<typeof LinkBookingDialog>[0]> = {}) {
  const onLinked = vi.fn();
  render(<LinkBookingDialog itineraryId="i1" dayId="d2" dayNumber={2} linkedBookingIds={[]} onLinked={onLinked} {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Link a booking" }));
  return { onLinked };
}

// source: spec P-26 - the user's Confirmed bookings; openapi BookingGroup - upcoming also lists Pending Payment
test("lists only the Confirmed upcoming flights that are not linked yet", async () => {
  const fetchMock = backend({ flights: [page([flight("f1"), flight("f2", "pending_payment", "NA102"), flight("f3", "confirmed", "NA103")])] });
  vi.stubGlobal("fetch", fetchMock);
  open({ linkedBookingIds: ["f3"] });

  const dialog = await screen.findByRole("dialog", { name: "Link a booking to Day 2" });
  expect(dialog.textContent).toContain("Pick one of your confirmed or completed bookings. Its price is added to this itinerary's budget.");
  await within(dialog).findByText(/NA101/);
  expect(within(dialog).queryByText(/NA102/)).toBeNull();
  expect(within(dialog).queryByText(/NA103/)).toBeNull();
  expect(within(dialog).getByText(/REFf1/)).toBeTruthy();
  expect(within(dialog).getByText(/CAI → DXB/)).toBeTruthy();
  const paths = fetchMock.mock.calls.map((c) => c[0]);
  expect(paths).toContain("/api/flight-bookings?group=upcoming&page=1");
  expect(paths).toContain("/api/hotel-bookings?group=upcoming&page=1");
});

// source: team leader decision 24 Nov - Completed bookings (past trips) can be linked too
test("also lists the Completed flights and hotel reservations of the past group, with their status", async () => {
  const fetchMock = backend({
    flights: [page([flight("f1")])],
    pastFlights: [page([flight("f7", "completed", "NA107"), flight("f8", "expired", "NA108")], 1, 2), page([flight("f6", "completed", "NA106")], 2, 2)],
    pastHotels: [page([hotel("b7", "completed"), hotel("b8", "cancelled")])],
  });
  vi.stubGlobal("fetch", fetchMock);
  open({ linkedBookingIds: ["f6"] });

  const row = (await screen.findByText(/NA107/)).closest("li")!;
  expect(within(row).getByText("Completed")).toBeTruthy();
  expect(within(screen.getByText(/NA101/).closest("li")!).getByText("Confirmed")).toBeTruthy();
  expect(screen.queryByText(/NA108/)).toBeNull();
  expect(screen.queryByText(/NA106/)).toBeNull();
  const paths = fetchMock.mock.calls.map((c) => c[0]);
  expect(paths).toContain("/api/flight-bookings?group=past&page=2");
  expect(paths).toContain("/api/hotel-bookings?group=past&page=1");

  fireEvent.mouseDown(screen.getByRole("tab", { name: "Hotels" }), { button: 0 });
  expect(within((await screen.findByText(/Nile View/)).closest("li")!).getByText("Completed")).toBeTruthy();
  expect(screen.getAllByText(/Nile View/)).toHaveLength(1);
});

test("reads every page of the backend list", async () => {
  const fetchMock = backend({ flights: [page([flight("f1")], 1, 2), page([flight("f9", "confirmed", "NA109")], 2, 2)] });
  vi.stubGlobal("fetch", fetchMock);
  open();

  await screen.findByText(/NA109/);
  expect(fetchMock.mock.calls.map((c) => c[0])).toContain("/api/flight-bookings?group=upcoming&page=2");
});

// source: GEN-05 - paginate every list longer than 10 rows
test("shows 10 bookings per page with Next and Previous", async () => {
  const many = Array.from({ length: 11 }, (_, i) => flight(`f${i}`, "confirmed", `NA${100 + i}`));
  vi.stubGlobal("fetch", backend({ flights: [page(many)] }));
  open();

  await screen.findByText(/NA100/);
  expect(screen.queryByText(/NA110/)).toBeNull();
  expect(screen.getByText("Page 1 of 2")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText(/NA110/)).toBeTruthy();
  expect(screen.queryByText(/NA100/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Previous" }));
  expect(screen.getByText(/NA100/)).toBeTruthy();
});

test("the Hotels tab lists the Confirmed hotel reservations with their total", async () => {
  vi.stubGlobal("fetch", backend({ hotels: [page([hotel("b1"), hotel("b2", "pending_payment")])] }));
  open();

  fireEvent.mouseDown(await screen.findByRole("tab", { name: "Hotels" }), { button: 0 });
  await screen.findByText(/Nile View/);
  expect(screen.getAllByText(/Nile View/)).toHaveLength(1);
  expect(screen.getByText(/\$450\.00/)).toBeTruthy();
});

// source: openapi AttachBookingRequest {bookingType, bookingId, dayId}; 201 LinkedBooking
test("links the chosen booking to the day, tells the user and hands the link to the page", async () => {
  const fetchMock = backend({ flights: [page([flight("f1")])] }, json(201, linked));
  vi.stubGlobal("fetch", fetchMock);
  const { onLinked } = open();

  fireEvent.click(await screen.findByRole("button", { name: "Link NA101" }));

  await waitFor(() => expect(onLinked).toHaveBeenCalledWith(linked));
  const post = fetchMock.mock.calls.find((c) => c[1]?.method === "POST")!;
  expect(post[0]).toBe("/api/itineraries/i1/bookings");
  expect(JSON.parse(post[1]!.body as string)).toEqual({ bookingType: "flight", bookingId: "f1", dayId: "d2" });
  expect(toast.success).toHaveBeenCalledWith("Booking linked to Day 2");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

// source: openapi 409 "The booking is not Confirmed, or it is already linked."
test("shows the backend's reason inside the dialog when linking fails and keeps it open", async () => {
  const message = "The booking is not Confirmed, or it is already linked.";
  vi.stubGlobal("fetch", backend({ flights: [page([flight("f1")])] }, json(409, { statusCode: 409, error: "CONFLICT", message })));
  const { onLinked } = open();

  fireEvent.click(await screen.findByRole("button", { name: "Link NA101" }));

  const dialog = screen.getByRole("dialog");
  expect((await within(dialog).findByRole("alert")).textContent).toContain(message);
  expect(onLinked).not.toHaveBeenCalled();
});

// source: GEN-04 - friendly empty state with one action
test("shows an empty state with a search action when there is nothing to link", async () => {
  vi.stubGlobal("fetch", backend({}));
  open();

  expect(await screen.findByText("No confirmed or completed flights")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Search flights" }).getAttribute("href")).toBe("/flights");
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Hotels" }), { button: 0 });
  expect(await screen.findByText("No confirmed or completed hotel reservations")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Search hotels" }).getAttribute("href")).toBe("/hotels");
});

// source: GEN-16 - error with a way to recover
test("shows an error with Retry when the bookings cannot be loaded", async () => {
  const fetchMock = backend({ flights: [json(500, { statusCode: 500, error: "INTERNAL", message: "Server down" }), page([flight("f1")])] });
  vi.stubGlobal("fetch", fetchMock);
  open();

  expect(await screen.findByText("Server down")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText(/NA101/)).toBeTruthy();
});

// source: team leader decision 24 Nov - unlink (DELETE /api/itineraries/{id}/bookings/{linkId}, 204)
test("UnlinkBookingButton asks first, then removes the link and tells the page", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  const onUnlinked = vi.fn();
  render(<UnlinkBookingButton itineraryId="i1" linkId="l1" onUnlinked={onUnlinked} />);

  fireEvent.click(screen.getByRole("button", { name: "Unlink" }));
  const dialog = await screen.findByRole("alertdialog", { name: "Unlink this booking?" });
  expect(dialog.textContent).toContain("It stays booked; it is only removed from this day and the budget.");
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Unlink" }));

  await waitFor(() => expect(onUnlinked).toHaveBeenCalledWith("l1"));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/itineraries/i1/bookings/l1");
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "DELETE" });
  expect(toast.success).toHaveBeenCalledWith("Booking unlinked");
});

test("UnlinkBookingButton shows the backend error and keeps the link", async () => {
  const message = "Itinerary or linked booking not found, or they belong to another user.";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(404, { statusCode: 404, error: "NOT_FOUND", message })));
  const onUnlinked = vi.fn();
  render(<UnlinkBookingButton itineraryId="i1" linkId="l1" onUnlinked={onUnlinked} />);

  fireEvent.click(screen.getByRole("button", { name: "Unlink" }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Unlink" }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
  expect(onUnlinked).not.toHaveBeenCalled();
});
