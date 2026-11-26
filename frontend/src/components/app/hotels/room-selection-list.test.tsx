// P-18 room list (HTL-15, GEN-05): every free room for the dates, 10 per page (?roomsPage=), checked rooms kept
// across pages, "Book selected rooms" opens P-19 with ?roomIds= (team leader, 26 Nov). Only the router is faked.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { formatCents } from "@/lib/format";

const nav = vi.hoisted(() => ({ push: vi.fn(), params: new URLSearchParams("checkIn=2027-03-01&checkOut=2027-03-04") }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: nav.push }), useSearchParams: () => nav.params }));

import { RoomSelectionList, type AvailableRoom } from "./room-selection-list";

afterEach(() => {
  cleanup();
  nav.push.mockReset();
  nav.params = new URLSearchParams("checkIn=2027-03-01&checkOut=2027-03-04");
});

// source: openapi GET /api/hotels/{id}/rooms/available item (3 nights: 1 to 4 March 2027)
const room = (n: number, maxOccupancy = 2): AvailableRoom => ({
  id: `r${n}`,
  roomNumber: String(100 + n),
  type: "double",
  beds: 1,
  maxOccupancy,
  pricePerNight: 10000 + n,
  nights: 3,
  totalPrice: (10000 + n) * 3,
  currency: "USD",
  checkIn: "2027-03-01",
  checkOut: "2027-03-04",
});
const rooms = (count: number) => Array.from({ length: count }, (_, i) => room(i + 1));
const show = (list: AvailableRoom[]) => render(<RoomSelectionList hotelId="h1" rooms={list} checkIn="2027-03-01" checkOut="2027-03-04" />);

test("HTL-15: each room shows type, beds, max occupancy, price per night and the total stay price", () => {
  show([room(1, 1)]);
  expect(screen.getByLabelText("Room 101 · double")).toBeTruthy();
  expect(screen.getByText("1 bed · up to 1 guest")).toBeTruthy();
  expect(screen.getByText(/3 nights/).textContent).toContain(formatCents(10001, "USD").replace(/\s*USD$/, ""));
  expect(screen.getByText(formatCents(30003, "USD"))).toBeTruthy();
});

test("GEN-05: 10 rooms per page; ?roomsPage=2 shows the rest and page links keep the dates", () => {
  const { rerender } = show(rooms(12));
  expect(screen.getAllByRole("checkbox")).toHaveLength(10);
  const next = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
  expect(next).toContain("?checkIn=2027-03-01&checkOut=2027-03-04&roomsPage=2");
  nav.params = new URLSearchParams("checkIn=2027-03-01&checkOut=2027-03-04&roomsPage=2");
  rerender(<RoomSelectionList hotelId="h1" rooms={rooms(12)} checkIn="2027-03-01" checkOut="2027-03-04" />);
  expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  expect(screen.getByLabelText("Room 112 · double")).toBeTruthy();
});

test("Book selected rooms is disabled until a room is checked", () => {
  show(rooms(2));
  const book = screen.getByRole("button", { name: "Book selected rooms" }) as HTMLButtonElement;
  expect(book.disabled).toBe(true);
  fireEvent.click(screen.getByLabelText("Room 101 · double"));
  expect(book.disabled).toBe(false);
  fireEvent.click(screen.getByLabelText("Room 101 · double"));
  expect(book.disabled).toBe(true);
});

test("HTL-16: checked rooms stay checked across pages and open P-19 with roomIds in list order", () => {
  const { rerender } = show(rooms(12));
  fireEvent.click(screen.getByLabelText("Room 103 · double"));
  nav.params = new URLSearchParams("checkIn=2027-03-01&checkOut=2027-03-04&roomsPage=2");
  rerender(<RoomSelectionList hotelId="h1" rooms={rooms(12)} checkIn="2027-03-01" checkOut="2027-03-04" />);
  fireEvent.click(screen.getByLabelText("Room 111 · double"));
  nav.params = new URLSearchParams("checkIn=2027-03-01&checkOut=2027-03-04&roomsPage=1");
  rerender(<RoomSelectionList hotelId="h1" rooms={rooms(12)} checkIn="2027-03-01" checkOut="2027-03-04" />);
  expect((screen.getByLabelText("Room 103 · double") as HTMLButtonElement).getAttribute("aria-checked")).toBe("true");
  fireEvent.click(screen.getByLabelText("Room 101 · double"));
  fireEvent.click(screen.getByRole("button", { name: "Book selected rooms" }));
  expect(nav.push).toHaveBeenCalledWith("/hotels/h1/book?checkIn=2027-03-01&checkOut=2027-03-04&roomIds=r1%2Cr3%2Cr11");
});

test("HTL-15: no free rooms shows the empty state", () => {
  show([]);
  expect(screen.getByText("No rooms available")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Book selected rooms" })).toBeNull();
});
