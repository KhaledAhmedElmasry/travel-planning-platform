// BookingListItem (FLT-25, HTL-20; spec P-20, P-22): one row of My bookings, opening the details.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { BookingListItem, type FlightBookingListItem, type HotelBookingListItem } from "./booking-list-item";

afterEach(cleanup);

// source: backend flight-bookings.service.ts toListItem() (GET /api/flight-bookings); Mock Data airports CAI, DXB
const flight: FlightBookingListItem = {
  id: "fb1",
  reference: "TP7K2Q",
  status: "confirmed",
  flightNumber: "NA101",
  departureAirport: "CAI",
  arrivalAirport: "DXB",
  departureAt: "2027-03-01T06:00:00.000Z",
  departureLocal: "2027-03-01 08:00 (Africa/Cairo)",
  passengers: 2,
  cabinClass: "premium_economy",
};

// source: backend hotel-bookings.service.ts toListItem() (GET /api/hotel-bookings)
const hotel: HotelBookingListItem = {
  id: "hb1",
  reference: "TP9X4Z",
  status: "cancelled",
  hotel: { id: "h1", name: "Nile View Hotel" },
  rooms: [
    { roomId: "r1", roomNumber: "101", type: "Double" },
    { roomId: "r2", roomNumber: "102", type: "Single" },
  ],
  checkIn: "2027-03-01",
  checkOut: "2027-03-04",
  guests: { adults: 2, children: 1 },
  totalAmount: 49500,
  currency: "USD",
};

// source: Excel FLT-25 - "showing reference, flight, date, passengers, cabin and status, and to open full details"
test("a flight booking row shows reference, flight, date, passengers, cabin and status, and opens the details", () => {
  render(<BookingListItem kind="flight" booking={flight} />);

  const link = screen.getByRole("link");
  expect(link.getAttribute("href")).toBe("/bookings/flights/fb1");
  const text = link.textContent!;
  expect(text).toContain("TP7K2Q");
  expect(text).toContain("NA101");
  expect(text).toContain("CAI → DXB");
  expect(text).toContain("Mon, 1 Mar 2027 08:00");
  expect(text).toContain("2 passengers");
  expect(text).toContain("Premium Economy");
  expect(text).toContain("Confirmed");
});

// source: Excel HTL-20 - "showing reference, hotel, rooms, dates, guests, total and status, and to open full details"
test("a hotel reservation row shows reference, hotel, rooms, dates, guests, total and status, and opens the details", () => {
  render(<BookingListItem kind="hotel" booking={hotel} />);

  const link = screen.getByRole("link");
  expect(link.getAttribute("href")).toBe("/bookings/hotels/hb1");
  const text = link.textContent!;
  expect(text).toContain("TP9X4Z");
  expect(text).toContain("Nile View Hotel");
  expect(text).toContain("Room 101 · Double");
  expect(text).toContain("Room 102 · Single");
  expect(text).toContain("Mon, 1 Mar 2027 – Thu, 4 Mar 2027");
  expect(text).toContain("2 adults, 1 child");
  expect(text).toContain("$495.00");
  expect(text).toContain("Cancelled");
});

// source: Excel FLT-25 - passengers count; spec P-20 row
test("one passenger is written in the singular", () => {
  render(<BookingListItem kind="flight" booking={{ ...flight, passengers: 1 }} />);
  expect(screen.getByRole("link").textContent).toContain("1 passenger");
  expect(screen.getByRole("link").textContent).not.toContain("1 passengers");
});
