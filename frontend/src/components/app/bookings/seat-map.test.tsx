// SeatMap (Bonus FLT-28; spec P-21): choose a seat per passenger on each flight of a Confirmed booking.
// Faked: fetch (backend), the router and the toast.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { SeatMap, type SeatBooking } from "./seat-map";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toast.success.mockReset();
  toast.error.mockReset();
  router.refresh.mockReset();
});

// source: backend flight-bookings.controller.ts details() seatAssignments (flight-seat-selection.service.ts SeatAssignmentResponse)
const booking: SeatBooking = {
  id: "fb1",
  segments: [{ flightId: "f1", flightNumber: "NA101" }],
  passengers: [
    { type: "adult", fullName: "Mona Adel" },
    { type: "infant", fullName: "Laila Adel" },
    { type: "child", fullName: "Omar Adel" },
  ],
  seatAssignments: [{ segment: "outbound", passengerIndex: 0, seatNumber: "12A" }],
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// source: Excel FLT-28 - seat selection; backend - infants have no seat (FLT-12: infants take no seat)
test("each passenger with a seat is listed per flight with the chosen seat; infants are not", () => {
  render(<SeatMap booking={booking} />);
  const flight = screen.getByRole("region", { name: "Seats on NA101" });
  expect(within(flight).getByLabelText("Mona Adel").getAttribute("value")).toBe("12A");
  expect(within(flight).getByLabelText("Omar Adel").getAttribute("value")).toBe("");
  expect(within(flight).queryByLabelText("Laila Adel")).toBeNull();
});

// source: Excel FLT-28 - seat selection; openapi PATCH /api/flight-bookings/{id}/seat body {passengerIndex, segment, seatNumber}
test("saving a seat sends the passenger's index on the booking, the flight and the seat", async () => {
  const fetchMock = vi.fn().mockResolvedValue(json(200, { id: "fb1", seatAssignments: [] }));
  vi.stubGlobal("fetch", fetchMock);
  render(<SeatMap booking={booking} />);

  fireEvent.change(screen.getByLabelText("Omar Adel"), { target: { value: "14c" } });
  fireEvent.click(screen.getByRole("button", { name: "Save seat for Omar Adel" }));

  await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  expect(fetchMock.mock.calls[0][0]).toBe("/api/flight-bookings/fb1/seat");
  expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ passengerIndex: 2, segment: "outbound", seatNumber: "14C" });
  expect(toast.success).toHaveBeenCalledWith("Seat 14C saved for Omar Adel");
});

// source: backend flight-seat-selection.service.ts - "The seat is already taken." (409)
test("a taken seat shows the backend's message", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(409, { statusCode: 409, error: "CONFLICT", message: "The seat is already taken." })));
  render(<SeatMap booking={booking} />);

  fireEvent.change(screen.getByLabelText("Omar Adel"), { target: { value: "12A" } });
  fireEvent.click(screen.getByRole("button", { name: "Save seat for Omar Adel" }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("The seat is already taken."));
  expect(router.refresh).not.toHaveBeenCalled();
});

// source: openapi seat - segment outbound | return; round trips choose a seat on each flight
test("a round trip has a seat list for each flight", () => {
  render(<SeatMap booking={{ ...booking, segments: [...booking.segments, { flightId: "f2", flightNumber: "NA102" }] }} />);
  expect(screen.getByRole("region", { name: "Seats on NA101" })).toBeDefined();
  expect(within(screen.getByRole("region", { name: "Seats on NA102" })).getByLabelText("Mona Adel").getAttribute("value")).toBe("");
});
