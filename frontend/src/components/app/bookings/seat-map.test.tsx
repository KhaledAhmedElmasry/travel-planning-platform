// SeatMap (Bonus FLT-28; spec P-21): a seat map per flight of a Confirmed booking (available / taken /
// selected), one seat per passenger. Faked: fetch (backend), the router and the toast.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { SeatMap, type SeatBooking, type SeatMapData } from "./seat-map";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toast.success.mockReset();
  toast.error.mockReset();
  router.refresh.mockReset();
});

// source: backend GET /api/flight-bookings/{id} passengers (infants take no seat, FLT-12)
const booking: SeatBooking = {
  id: "fb1",
  passengers: [
    { type: "adult", fullName: "Mona Adel" },
    { type: "infant", fullName: "Laila Adel" },
    { type: "child", fullName: "Omar Adel" },
  ],
};

// source: openapi SeatMap (GET /api/flight-bookings/{id}/seats, team leader decision 24 Nov - seat map
// route, backend PR #289): a 6-seat business cabin = rows 1-2, letters A-D, last row partly filled
const seats = (list: [string, "available" | "taken" | "mine", number | null][]) =>
  list.map(([seatNumber, status, passengerIndex]) => ({ seatNumber, status, passengerIndex }));
const map: SeatMapData = {
  bookingId: "fb1",
  segments: [
    {
      segment: "outbound",
      flightNumber: "NA101",
      cabinClass: "business",
      rows: 2,
      letters: "ABCD",
      seats: seats([
        ["1A", "available", null],
        ["1B", "mine", 0],
        ["1C", "available", null],
        ["1D", "available", null],
        ["2A", "taken", null],
        ["2B", "available", null],
      ]),
    },
  ],
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// source: team leader decision 24 Nov - seat map (available / taken / selected); spec P-21 FLT-28
test("each flight shows every seat: free ones can be chosen, taken ones cannot, the passengers' own are marked", () => {
  render(<SeatMap booking={booking} map={map} />);
  const flight = screen.getByRole("region", { name: "Seats on NA101" });
  const seatButtons = within(flight).getAllByRole("button", { name: /^Seat / });
  expect(seatButtons.map((b) => b.getAttribute("aria-label"))).toEqual([
    "Seat 1A, available",
    "Seat 1B, Mona Adel",
    "Seat 1C, available",
    "Seat 1D, available",
    "Seat 2A, taken",
    "Seat 2B, available",
  ]);
  expect((within(flight).getByRole("button", { name: "Seat 2A, taken" }) as HTMLButtonElement).disabled).toBe(true);
  expect((within(flight).getByRole("button", { name: "Seat 1A, available" }) as HTMLButtonElement).disabled).toBe(false);
});

// source: team leader decision 24 Nov - one seat per passenger; backend - infants have no seat (FLT-12)
test("the passengers with a seat are listed with their seat; the first one is chosen; infants are not listed", () => {
  render(<SeatMap booking={booking} map={map} />);
  const flight = screen.getByRole("region", { name: "Seats on NA101" });
  const mona = within(flight).getByRole("button", { name: "Choose a seat for Mona Adel (seat 1B)" });
  const omar = within(flight).getByRole("button", { name: "Choose a seat for Omar Adel (no seat yet)" });
  expect(mona.getAttribute("aria-pressed")).toBe("true");
  expect(omar.getAttribute("aria-pressed")).toBe("false");
  expect(within(flight).queryByRole("button", { name: /Laila Adel/ })).toBeNull();
  // The chosen passenger's own seat is the selected one.
  expect(within(flight).getByRole("button", { name: "Seat 1B, Mona Adel" }).getAttribute("aria-pressed")).toBe("true");

  fireEvent.click(omar);
  expect(omar.getAttribute("aria-pressed")).toBe("true");
  expect(within(flight).getByRole("button", { name: "Seat 1B, Mona Adel" }).getAttribute("aria-pressed")).toBe("false");
});

// source: openapi PATCH /api/flight-bookings/{id}/seat body {passengerIndex, segment, seatNumber}
test("clicking a free seat saves it for the chosen passenger and reloads the map", async () => {
  const fetchMock = vi.fn().mockResolvedValue(json(200, { id: "fb1", seatAssignments: [] }));
  vi.stubGlobal("fetch", fetchMock);
  render(<SeatMap booking={booking} map={map} />);

  fireEvent.click(screen.getByRole("button", { name: "Choose a seat for Omar Adel (no seat yet)" }));
  fireEvent.click(screen.getByRole("button", { name: "Seat 1A, available" }));

  await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  expect(fetchMock.mock.calls[0][0]).toBe("/api/flight-bookings/fb1/seat");
  expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ passengerIndex: 2, segment: "outbound", seatNumber: "1A" });
  expect(toast.success).toHaveBeenCalledWith("Seat 1A saved for Omar Adel");
});

// source: backend flight-seat-selection.service.ts - "The seat is already taken." (409, two users at once)
test("a seat taken in the meantime shows the backend's message", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(409, { statusCode: 409, error: "CONFLICT", message: "The seat is already taken." })));
  render(<SeatMap booking={booking} map={map} />);

  fireEvent.click(screen.getByRole("button", { name: "Seat 1C, available" }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("The seat is already taken."));
  expect(router.refresh).not.toHaveBeenCalled();
});

// source: openapi SeatMap segments (outbound, then return); seat body segment outbound | return
test("a round trip has a map for each flight; the return map saves the return seat", async () => {
  const fetchMock = vi.fn().mockResolvedValue(json(200, { id: "fb1", seatAssignments: [] }));
  vi.stubGlobal("fetch", fetchMock);
  const back = { ...map.segments[0], segment: "return" as const, flightNumber: "NA102", seats: seats([["1A", "available", null]]) };
  render(<SeatMap booking={booking} map={{ ...map, segments: [map.segments[0], back] }} />);

  expect(screen.getByRole("region", { name: "Seats on NA101" })).toBeDefined();
  const ret = screen.getByRole("region", { name: "Seats on NA102" });
  expect(within(ret).getByRole("button", { name: "Choose a seat for Mona Adel (no seat yet)" })).toBeDefined();
  fireEvent.click(within(ret).getByRole("button", { name: "Seat 1A, available" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ passengerIndex: 0, segment: "return", seatNumber: "1A" });
});
