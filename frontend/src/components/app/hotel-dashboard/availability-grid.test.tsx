// Hotel availability calendar grid (HTL-08): each room's status per date of the chosen range.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { AvailabilityGrid, type RoomAvailabilityRow } from "./availability-grid";

afterEach(cleanup);

const ROOMS: RoomAvailabilityRow[] = [
  {
    id: "r1",
    roomNumber: "101",
    dates: [
      { date: "2027-03-01", status: "available", reference: null },
      { date: "2027-03-02", status: "booked", reference: "TPAB12" },
      { date: "2027-03-03", status: "blocked", reference: null },
    ],
  },
  {
    id: "r2",
    roomNumber: "102",
    dates: [
      { date: "2027-03-01", status: "booked", reference: "TPCD34" },
      { date: "2027-03-02", status: "available", reference: null },
      { date: "2027-03-03", status: "available", reference: null },
    ],
  },
];

const rowOf = (roomNumber: string) => screen.getByRole("row", { name: new RegExp(roomNumber) });

// source: Excel HTL-08 "view each room's status" - every room of the hotel gets its own row
test("every room is shown as its own row", () => {
  render(<AvailabilityGrid rooms={ROOMS} />);
  expect(rowOf("101")).toBeTruthy();
  expect(rowOf("102")).toBeTruthy();
});

// source: Excel HTL-08 "for a chosen date range" - one status per room per date of the range
test("each room shows one status for every date of the range", () => {
  render(<AvailabilityGrid rooms={ROOMS} />);
  const statuses = within(rowOf("101")).getAllByText(/^(Available|Booked|Blocked)$/);
  expect(statuses).toHaveLength(3);
});

// source: Excel HTL-08 "status ... as Available"
test("a free date shows Available", () => {
  render(<AvailabilityGrid rooms={[{ ...ROOMS[0], dates: [ROOMS[0].dates[0]] }]} />);
  expect(within(rowOf("101")).getByText("Available")).toBeTruthy();
});

// source: Excel HTL-08 "Booked (with reservation reference)"
test("a reserved date shows Booked with its reservation reference", () => {
  render(<AvailabilityGrid rooms={[{ ...ROOMS[0], dates: [ROOMS[0].dates[1]] }]} />);
  const row = rowOf("101");
  expect(within(row).getByText("Booked")).toBeTruthy();
  expect(within(row).getByText(/TPAB12/)).toBeTruthy();
});

// source: Excel HTL-08 "or Blocked"
test("a blocked date shows Blocked", () => {
  render(<AvailabilityGrid rooms={[{ ...ROOMS[0], dates: [ROOMS[0].dates[2]] }]} />);
  expect(within(rowOf("101")).getByText("Blocked")).toBeTruthy();
});

// source: Excel HTL-08 "each room's status" - the status belongs to the right room (no mixing between rooms)
test("each room shows its own statuses and references", () => {
  render(<AvailabilityGrid rooms={ROOMS} />);
  const second = rowOf("102");
  expect(within(second).getByText(/TPCD34/)).toBeTruthy();
  expect(within(second).queryByText(/TPAB12/)).toBeNull();
  expect(within(second).getAllByText("Available")).toHaveLength(2);
  expect(within(second).queryByText("Blocked")).toBeNull();
});
