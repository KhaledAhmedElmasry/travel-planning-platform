// Hotel moderator home (/hotel): today's check-ins and check-outs, stat cards, quick actions,
// reservations list (ACC-04; spec section 2, Hotel Moderator row).
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { HotelOverview, type Reservation } from "./hotel-overview";

afterEach(cleanup);

// source: backend/src/hotels/hotels.service.ts listReservations item (GET /api/hotels/{id}/reservations)
const stay = (id: string, checkIn: string, checkOut: string, roomIds: string[], guest = "Mona Adel"): Reservation => ({
  id,
  reference: `TP${id.toUpperCase()}`,
  guest: { id: "u1", name: guest },
  rooms: roomIds.map((roomId) => ({ roomId, roomNumber: roomId.replace("r", "1"), type: "Double" })),
  checkIn,
  checkOut,
  status: "confirmed",
});
const TODAY = "2027-03-10";
const base = { date: TODAY, roomsTotal: 5, activeRoomIds: ["r01", "r02", "r03", "r04"], upcoming: [] as Reservation[], confirmed: [] as Reservation[] };

// source: MILESTONE2_FRONTEND_SPEC.md section 2 Hotel Moderator row - today's check-ins and check-outs
test("stays starting today are check-ins, stays ending today are check-outs, others are neither", () => {
  render(
    <HotelOverview
      {...base}
      today={[
        stay("a1", TODAY, "2027-03-12", ["r01"], "Mona Adel"),
        stay("b2", "2027-03-08", TODAY, ["r02"], "Omar Adel"),
        stay("c3", "2027-03-09", "2027-03-11", ["r03"], "Sara Ali"),
      ]}
    />,
  );

  const checkIns = screen.getByRole("region", { name: "Today's check-ins" }).textContent!;
  expect(checkIns).toContain("TPA1");
  expect(checkIns).toContain("Mona Adel");
  expect(checkIns).toContain("Room 101");
  expect(checkIns).not.toContain("TPB2");
  expect(checkIns).not.toContain("TPC3");
  const checkOuts = screen.getByRole("region", { name: "Today's check-outs" }).textContent!;
  expect(checkOuts).toContain("TPB2");
  expect(checkOuts).toContain("Omar Adel");
  expect(checkOuts).not.toContain("TPA1");
  expect(checkOuts).not.toContain("TPC3");
});

// source: Excel GEN-04 - empty lists show a helpful message
test("a day without check-ins or check-outs says so", () => {
  render(<HotelOverview {...base} today={[]} />);
  expect(within(screen.getByRole("region", { name: "Today's check-ins" })).getByText("No check-ins today")).toBeTruthy();
  expect(within(screen.getByRole("region", { name: "Today's check-outs" })).getByText("No check-outs today")).toBeTruthy();
});

// source: team leader decision 24 Nov - occupancy = active rooms with a booked night for today / active rooms;
// MILESTONE2_FRONTEND_SPEC.md section 2 - stat cards (rooms, occupancy)
test("rooms counts every room; occupancy counts active rooms whose night of today is booked", () => {
  render(
    <HotelOverview
      {...base}
      today={[
        stay("a1", TODAY, "2027-03-12", ["r01", "r02"]), // night of today booked: r01, r02
        stay("b2", "2027-03-08", TODAY, ["r03"]), // leaves today: night of today is free
        stay("c3", "2027-03-09", "2027-03-11", ["r02", "r99"]), // r02 counted once, r99 is not active
      ]}
    />,
  );

  expect(screen.getByText("Rooms").parentElement!.textContent).toBe("Rooms5");
  expect(screen.getByText("Occupancy").parentElement!.textContent).toBe("Occupancy50%");
});

test("occupancy is 0% when the hotel has no active room", () => {
  render(<HotelOverview {...base} activeRoomIds={[]} today={[]} />);
  expect(screen.getByText("Occupancy").parentElement!.textContent).toBe("Occupancy0%");
});

// source: team leader decision 24 Nov - "Reservations" stat card = Confirmed reservations with check-in date from today on
test("the Reservations card counts confirmed stays checking in today or later, not stays already in progress", () => {
  render(
    <HotelOverview
      {...base}
      today={[]}
      confirmed={[
        stay("a1", TODAY, "2027-03-12", ["r01"]), // checks in today: counted
        stay("b2", "2027-03-20", "2027-03-22", ["r02"]), // later: counted
        stay("c3", "2027-03-09", "2027-03-11", ["r03"]), // in progress since yesterday: not counted
      ]}
    />,
  );

  expect(screen.getByText("Reservations", { selector: "span" }).parentElement!.textContent).toBe("Reservations2");
});

// source: team leader decision 24 Nov - lists on the homes show 5 items + a "See all" link
test("the reservations list shows 5 with See all to the reservations page", () => {
  const upcoming = ["s1", "s2", "s3", "s4", "s5", "s6"].map((id) => stay(id, "2027-03-20", "2027-03-22", ["r01"]));
  render(<HotelOverview {...base} today={[]} upcoming={upcoming} />);

  const region = screen.getByRole("region", { name: "Reservations" });
  expect(within(region).getAllByRole("listitem")).toHaveLength(5);
  expect(region.textContent).not.toContain("TPS6");
  expect(within(region).getByRole("link", { name: "See all" }).getAttribute("href")).toBe("/hotel/reservations");
});

// source: MILESTONE2_FRONTEND_SPEC.md section 2 Hotel Moderator row - quick actions (add room, block dates, policies); routes in src/lib/nav.ts
test("quick actions open rooms (add a room, block dates per room) and policies", () => {
  render(<HotelOverview {...base} today={[]} />);
  const links = within(screen.getByRole("region", { name: "Quick actions" }))
    .getAllByRole("link")
    .map((a) => [a.textContent, a.getAttribute("href")]);
  expect(links).toEqual([
    ["Add room", "/hotel/rooms"],
    ["Block dates", "/hotel/rooms"],
    ["Policies", "/hotel/policies"],
  ]);
});
