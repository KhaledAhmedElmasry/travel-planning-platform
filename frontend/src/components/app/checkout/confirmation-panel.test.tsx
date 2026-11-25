// ConfirmationPanel (FLT-23, HTL-17; spec P-17): unique booking reference, booking details,
// flights: Download e-ticket (PDF); links to My bookings and the booking details.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ConfirmationPanel, type ConfirmedFlightBooking, type ConfirmedHotelBooking } from "./confirmation-panel";

afterEach(cleanup);

// source: openapi FlightBooking (GET /api/flight-bookings/{id}); Mock Data airports CAI, DXB
const flight: ConfirmedFlightBooking = {
  id: "fb1",
  reference: "TP7K2Q",
  status: "confirmed",
  segments: [
    {
      flightId: "f1",
      flightNumber: "NA101",
      airlineName: "Nile Air",
      cabinClass: "economy",
      departureAirport: "CAI",
      arrivalAirport: "DXB",
      departureLocal: "2027-03-01T08:00",
      arrivalLocal: "2027-03-01T13:30",
    },
  ],
  passengers: [
    { type: "adult", fullName: "Mona Adel" },
    { type: "child", fullName: "Omar Adel" },
  ],
  totalAmount: 63000,
  currency: "USD",
};
// source: openapi HotelBooking (GET /api/hotel-bookings/{id})
const hotel: ConfirmedHotelBooking = {
  id: "hb1",
  reference: "TP9X4Z",
  status: "confirmed",
  hotel: { id: "h1", name: "Nile View Hotel" },
  checkIn: "2027-03-01",
  checkOut: "2027-03-04",
  nights: 3,
  rooms: [{ roomId: "r1", roomNumber: "101", type: "Double" }],
  totalAmount: 49500,
  currency: "USD",
};

// source: Excel FLT-23 - unique booking reference, confirmation page, downloadable e-ticket (PDF)
test("a flight confirmation shows the reference, the flight, the passengers, the total and the e-ticket", () => {
  render(<ConfirmationPanel kind="flight" booking={flight} />);

  const text = screen.getByRole("region", { name: /confirmed/i }).textContent!;
  expect(text).toContain("TP7K2Q");
  expect(text).toContain("NA101");
  expect(text).toContain("CAI");
  expect(text).toContain("DXB");
  expect(text).toContain("08:00");
  expect(text).toContain("Mona Adel");
  expect(text).toContain("Omar Adel");
  expect(text).toContain("630.00");
  expect(screen.getByRole("link", { name: /e-ticket/i }).getAttribute("href")).toBe("/api/flight-bookings/fb1/e-ticket");
});

// source: Excel HTL-17 - unique booking reference, confirmation page with the reservation details
test("a hotel confirmation shows the reference, the hotel, the dates, the rooms and the total, without an e-ticket", () => {
  render(<ConfirmationPanel kind="hotel" booking={hotel} />);

  const text = screen.getByRole("region", { name: /confirmed/i }).textContent!;
  expect(text).toContain("TP9X4Z");
  expect(text).toContain("Nile View Hotel");
  expect(text).toContain("3 nights");
  expect(text).toContain("101");
  expect(text).toContain("495.00");
  expect(screen.queryByRole("link", { name: /e-ticket/i })).toBeNull();
});

// source: spec P-17 - links to My bookings and the booking details
test("links to My bookings and to the booking details", () => {
  render(<ConfirmationPanel kind="flight" booking={flight} />);
  expect(screen.getByRole("link", { name: /my bookings/i }).getAttribute("href")).toBe("/bookings");
  expect(screen.getByRole("link", { name: /booking details/i }).getAttribute("href")).toBe("/bookings/flights/fb1");
  cleanup();

  render(<ConfirmationPanel kind="hotel" booking={hotel} />);
  expect(screen.getByRole("link", { name: /booking details/i }).getAttribute("href")).toBe("/bookings/hotels/hb1");
});

// source: MASTER.md section 9 - "Jumping + confetti | Booking confirmed | Mabrouk! Your trip is booked."
test("So3ad celebrates the confirmed booking", () => {
  const { container } = render(<ConfirmationPanel kind="hotel" booking={hotel} />);

  expect(screen.getByText("“Mabrouk! Your trip is booked.”")).toBeDefined();
  expect(container.querySelector('svg[data-pose="jump"]')).not.toBeNull();
});
