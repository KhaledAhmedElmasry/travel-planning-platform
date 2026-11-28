// P-43 room form (HTL-03 add a room, HTL-05 edit a room). Only fetch and the toast are faked.
// Request field names (roomNumber, type, beds, maxOccupancy, pricePerNight) are the backend contract, used only to wire the call.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { RoomForm, type HotelRoom } from "./room-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toast.success.mockReset();
  toast.error.mockReset();
});

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function stubFetch(response: () => Response) {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => response());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const ROOM: HotelRoom = {
  id: "r1",
  roomNumber: "101",
  type: "Deluxe double",
  beds: 2,
  maxOccupancy: 2,
  pricePerNight: 12000,
  currency: "USD",
  active: true,
  availableRanges: [],
  blockedRanges: [],
  everReserved: false,
};

const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

function fillNewRoom(over: Partial<Record<"number" | "type" | "beds" | "guests" | "price", string>> = {}) {
  type(/room number or name/i, over.number ?? "101");
  type(/room type/i, over.type ?? "Deluxe double");
  type(/beds/i, over.beds ?? "2");
  type(/maximum guests/i, over.guests ?? "3");
  type(/price per night/i, over.price ?? "120");
}

const body = (fetchMock: ReturnType<typeof stubFetch>, call = 0) => JSON.parse(fetchMock.mock.calls[call][1].body as string);

// source: Excel HTL-03 "add a room ... room number/name ..., type, number of beds, maximum occupancy and price per night";
// PDF .md 8.5 "POST /api/hotels/:id/rooms HTL-03"
test("adding a room sends its number, type, beds and maximum occupancy to POST /api/hotels/:id/rooms", async () => {
  const fetchMock = stubFetch(() => jsonResponse(201, { id: "r9" }));
  const onDone = vi.fn();
  render(<RoomForm hotelId="h1" onDone={onDone} onCancel={vi.fn()} />);

  fillNewRoom();
  fireEvent.click(screen.getByRole("button", { name: /add room/i }));

  await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe("/api/hotels/h1/rooms");
  expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  expect(body(fetchMock)).toMatchObject({ roomNumber: "101", type: "Deluxe double", beds: 2, maxOccupancy: 3 });
});

// source: Excel HTL-03 "price per night (>0)"; GEN-02 "field-level validation messages on all forms"
test("a price per night of 0 is refused before sending, with a message on the price field", () => {
  const fetchMock = stubFetch(() => jsonResponse(201, {}));
  render(<RoomForm hotelId="h1" onDone={vi.fn()} onCancel={vi.fn()} />);

  fillNewRoom({ price: "0" });
  fireEvent.click(screen.getByRole("button", { name: /add room/i }));

  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByLabelText(/price per night/i).getAttribute("aria-invalid")).toBe("true");
});

// source: Excel HTL-03 "maximum occupancy (>=1)"; GEN-02 "field-level validation messages on all forms"
test("a maximum occupancy of 0 is refused before sending, with a message on that field", () => {
  const fetchMock = stubFetch(() => jsonResponse(201, {}));
  render(<RoomForm hotelId="h1" onDone={vi.fn()} onCancel={vi.fn()} />);

  fillNewRoom({ guests: "0" });
  fireEvent.click(screen.getByRole("button", { name: /add room/i }));

  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByLabelText(/maximum guests/i).getAttribute("aria-invalid")).toBe("true");
});

// source: Excel HTL-03 "with a room number/name"; GEN-02 "field-level validation messages on all forms"
test("a room without a number or name is refused before sending, with a message on that field", () => {
  const fetchMock = stubFetch(() => jsonResponse(201, {}));
  render(<RoomForm hotelId="h1" onDone={vi.fn()} onCancel={vi.fn()} />);

  fillNewRoom({ number: "   " });
  fireEvent.click(screen.getByRole("button", { name: /add room/i }));

  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByLabelText(/room number or name/i).getAttribute("aria-invalid")).toBe("true");
});

// source: Excel HTL-03 "room number/name unique within the hotel"; GEN-02 field-level messages; GEN-16 "understandable error messages"
test("a duplicate room number refused by the backend is shown on the room number field", async () => {
  const message = "Room number 101 already exists in this hotel";
  stubFetch(() => jsonResponse(409, { statusCode: 409, error: "Conflict", message }));
  const onDone = vi.fn();
  render(<RoomForm hotelId="h1" onDone={onDone} onCancel={vi.fn()} />);

  fillNewRoom();
  fireEvent.click(screen.getByRole("button", { name: /add room/i }));

  const input = screen.getByLabelText(/room number or name/i);
  await waitFor(() => expect(input.getAttribute("aria-invalid")).toBe("true"));
  const describedBy = (input.getAttribute("aria-describedby") ?? "").split(" ");
  const texts = describedBy.map((id) => document.getElementById(id)?.textContent ?? "");
  expect(texts.some((t) => t.includes(message))).toBe(true);
  expect(onDone).not.toHaveBeenCalled();
});

// source: GEN-02 "field-level validation messages on all forms" (backend field errors, GEN-13 backend validation)
test("a field error returned by the backend is shown under that field", async () => {
  stubFetch(() =>
    jsonResponse(400, {
      statusCode: 400,
      error: "Bad Request",
      message: "Validation failed",
      fieldErrors: [{ field: "beds", messages: ["beds must not be greater than 10"] }],
    }),
  );
  render(<RoomForm hotelId="h1" onDone={vi.fn()} onCancel={vi.fn()} />);

  fillNewRoom();
  fireEvent.click(screen.getByRole("button", { name: /add room/i }));

  const input = screen.getByLabelText(/beds/i);
  await waitFor(() => expect(input.getAttribute("aria-invalid")).toBe("true"));
  const ids = (input.getAttribute("aria-describedby") ?? "").split(" ");
  expect(ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ")).toContain("beds must not be greater than 10");
});

// source: Excel HTL-05 "edit a room's beds, occupancy, price"; PDF .md 8.5 "PATCH /api/hotels/:id/rooms/:roomId HTL-05"
test("editing a room sends the new beds and occupancy to PATCH /api/hotels/:id/rooms/:roomId", async () => {
  const fetchMock = stubFetch(() => jsonResponse(200, { ...ROOM, beds: 3, maxOccupancy: 4 }));
  const onDone = vi.fn();
  render(<RoomForm hotelId="h1" room={ROOM} onDone={onDone} onCancel={vi.fn()} />);

  type(/beds/i, "3");
  type(/maximum guests/i, "4");
  fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

  await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/hotels/h1/rooms/r1");
  expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
  expect(body(fetchMock)).toMatchObject({ beds: 3, maxOccupancy: 4 });
});

// source: Excel HTL-05 "edit a room's ... price" together with HTL-03 "price per night (>0)"; GEN-02
test("editing a room to a price per night of 0 is refused before sending", () => {
  const fetchMock = stubFetch(() => jsonResponse(200, ROOM));
  render(<RoomForm hotelId="h1" room={ROOM} onDone={vi.fn()} onCancel={vi.fn()} />);

  type(/price per night/i, "0");
  fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByLabelText(/price per night/i).getAttribute("aria-invalid")).toBe("true");
});
