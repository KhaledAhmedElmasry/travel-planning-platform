// P-43 rooms of the hotel (HTL-06 deactivate / delete a room, GEN-03 confirmation).
// Only fetch, the router and the toast are faked.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const refresh = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }) }));

import { RoomsManager } from "./rooms-manager";
import type { HotelRoom } from "./room-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toast.success.mockReset();
  toast.error.mockReset();
  refresh.mockReset();
});

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function stubFetch(response: () => Response) {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => response());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const room = (over: Partial<HotelRoom>): HotelRoom => ({
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
  ...over,
});

const NEVER_RESERVED = room({ id: "r1", roomNumber: "101", everReserved: false });
const RESERVED_BEFORE = room({ id: "r2", roomNumber: "202", everReserved: true });

const row = (roomNumber: string) => screen.getByText(roomNumber).closest("tr") as HTMLElement;

// source: Excel GEN-03 "ask for confirmation before destructive actions (delete, cancel)"; HTL-06 "delete a room"
test("clicking Delete on a room sends nothing until the deletion is confirmed", async () => {
  const fetchMock = stubFetch(() => new Response(null, { status: 204 }));
  render(<RoomsManager hotelId="h1" rooms={[NEVER_RESERVED]} />);

  fireEvent.click(within(row("101")).getByRole("button", { name: /delete/i }));

  expect(await screen.findByRole("alertdialog")).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
});

// source: Excel HTL-06 "delete a room"; PDF .md 8.5 "DELETE /api/hotels/:id/rooms/:roomId HTL-06"; GEN-03 confirmation
test("confirming the deletion sends DELETE /api/hotels/:id/rooms/:roomId", async () => {
  const fetchMock = stubFetch(() => new Response(null, { status: 204 }));
  render(<RoomsManager hotelId="h1" rooms={[NEVER_RESERVED]} />);

  fireEvent.click(within(row("101")).getByRole("button", { name: /delete/i }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: /delete/i }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/hotels/h1/rooms/r1");
  expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
});

// source: Excel GEN-03 confirmation before delete; GEN-14 "cancel actions where applicable"
test("cancelling the delete confirmation sends nothing", async () => {
  const fetchMock = stubFetch(() => new Response(null, { status: 204 }));
  render(<RoomsManager hotelId="h1" rooms={[NEVER_RESERVED]} />);

  fireEvent.click(within(row("101")).getByRole("button", { name: /delete/i }));
  const dialog = await screen.findByRole("alertdialog");
  const cancel = within(dialog)
    .getAllByRole("button")
    .find((b) => !/delete/i.test(b.textContent ?? "")) as HTMLElement;
  fireEvent.click(cancel);

  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(fetchMock).not.toHaveBeenCalled();
});

// source: Excel HTL-06 "deletion is allowed only for rooms that have never been reserved"
test("a room that was reserved before cannot be deleted", () => {
  stubFetch(() => new Response(null, { status: 204 }));
  render(<RoomsManager hotelId="h1" rooms={[NEVER_RESERVED, RESERVED_BEFORE]} />);

  const enabledDelete = within(row("202"))
    .queryAllByRole("button", { name: /delete/i })
    .filter((b) => !(b as HTMLButtonElement).disabled);
  expect(enabledDelete).toHaveLength(0);
});

// source: Excel HTL-06 "deactivate ... a room"; PDF .md 8.5 "PATCH /api/hotels/:id/rooms/:roomId HTL-05" (room edit route)
test("deactivating a room sends active false to PATCH /api/hotels/:id/rooms/:roomId", async () => {
  const fetchMock = stubFetch(() => jsonResponse(200, { ...NEVER_RESERVED, active: false }));
  render(<RoomsManager hotelId="h1" rooms={[NEVER_RESERVED]} />);

  fireEvent.click(within(row("101")).getByRole("button", { name: /deactivate/i }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: /deactivate/i }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/hotels/h1/rooms/r1");
  expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ active: false });
});

// source: Excel HTL-06 "deletion is rejected if it overlaps any Confirmed or Pending Payment reservation";
// GEN-16 "understandable error messages" (the backend's message is shown)
test("a deletion refused by the backend shows the backend's message", async () => {
  const message = "This room has a Confirmed reservation";
  stubFetch(() => jsonResponse(409, { statusCode: 409, error: "Conflict", message }));
  render(<RoomsManager hotelId="h1" rooms={[NEVER_RESERVED]} />);

  fireEvent.click(within(row("101")).getByRole("button", { name: /delete/i }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: /delete/i }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
  expect(toast.success).not.toHaveBeenCalled();
});

// source: Excel HTL-06 "deactivation is rejected if it overlaps any Confirmed or Pending Payment reservation"; GEN-16
test("a deactivation refused by the backend shows the backend's message", async () => {
  const message = "This room has a Pending Payment reservation";
  stubFetch(() => jsonResponse(409, { statusCode: 409, error: "Conflict", message }));
  render(<RoomsManager hotelId="h1" rooms={[NEVER_RESERVED]} />);

  fireEvent.click(within(row("101")).getByRole("button", { name: /deactivate/i }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: /deactivate/i }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
  expect(toast.success).not.toHaveBeenCalled();
});
