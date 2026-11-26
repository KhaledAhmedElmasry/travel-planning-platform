// P-23 Hotel reservation details (HTL-20, HTL-21, PAY-03, GEN-03). Fetch, the router and the toast are faked.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { HotelBookingDetails, type HotelBookingDetailsData } from "./hotel-booking-details";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toast.success.mockReset();
  toast.error.mockReset();
  router.refresh.mockReset();
});

const NOW = new Date("2027-02-01T10:00:00.000Z");

// source: backend hotel-bookings.controller.ts details() = toResponse() + hotel check-in/out times, payment, refund, cancellation, review (HTL-23)
const booking: HotelBookingDetailsData = {
  id: "hb1",
  reference: "TP9X4Z",
  status: "confirmed",
  holdExpiresAt: null,
  hotel: { id: "h1", name: "Nile View Hotel", checkInTime: "14:00", checkOutTime: "12:00" },
  checkIn: "2027-03-01",
  checkOut: "2027-03-04",
  nights: 3,
  rooms: [
    { roomId: "r1", roomNumber: "101", type: "Double", beds: 2, adults: 2, childrenAges: [5], pricePerNight: 12000, subtotal: 36000 },
    { roomId: "r2", roomNumber: "102", type: "Single", beds: 1, adults: 1, childrenAges: [], pricePerNight: 5000, subtotal: 15000 },
  ],
  guests: { adults: 3, children: 1 },
  totalAmount: 51000,
  currency: "USD",
  payment: { status: "succeeded" },
  refund: null,
  cancellation: {
    cancellable: true,
    reason: null,
    daysBefore: 27,
    refundPercentage: 100,
    tierDaysBefore: 7,
    refundAmount: 51000,
    currency: "USD",
  },
  review: null,
};

function cancelButtonInDialog(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "Cancel reservation")!;
}

// source: Excel HTL-20 - full details; spec P-23 - all details, payment status
test("shows the hotel, the dates, the check-in and check-out times, the rooms with their guests, the total, the status and the payment status", () => {
  render(<HotelBookingDetails booking={booking} now={NOW} />);
  const text = document.body.textContent!;
  expect(text).toContain("TP9X4Z");
  expect(text).toContain("Nile View Hotel");
  expect(text).toContain("Mon, 1 Mar 2027 – Thu, 4 Mar 2027 · 3 nights");
  expect(text).toContain("Check-in from 14:00 · Check-out by 12:00");
  expect(text).toContain("Room 101 · Double · 2 beds · 2 adults, 1 child (5)");
  expect(text).toContain("Room 102 · Single · 1 bed · 1 adult");
  expect(text).toContain("$120.00");
  expect(text).toContain("$360.00");
  expect(text).toContain("$510.00");
  expect(text).toContain("Confirmed");
  expect(text).toContain("Paid");
});

// source: Excel PAY-03 - show the refund status (Pending, Refunded, Failed) on the booking details
test("shows the refund status and amount", () => {
  render(
    <HotelBookingDetails
      booking={{ ...booking, status: "cancelled", refund: { id: "r1", amount: 51000, currency: "USD", refundPercentage: 100, status: "failed" } }}
      now={NOW}
    />,
  );
  const refund = screen.getByRole("region", { name: "Refund status" });
  expect(refund.textContent).toContain("Refund failed");
  expect(refund.textContent).toContain("$510.00");
  expect(refund.textContent).toContain("100%");
});

// source: Excel HTL-21 - "after viewing the refund computed from the hotel's tiers on the full total" and confirming; GEN-03
test("cancelling shows the refund on the full total first and cancels the whole reservation after confirming", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...booking, status: "cancelled" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  render(<HotelBookingDetails booking={booking} now={NOW} />);

  fireEvent.click(screen.getByRole("button", { name: "Cancel reservation" }));
  const dialog = await screen.findByRole("alertdialog");
  expect(dialog.textContent).toContain("$510.00");
  expect(dialog.textContent).toContain("100%");
  expect(fetchMock).not.toHaveBeenCalled();

  fireEvent.click(cancelButtonInDialog(dialog));
  await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  expect(fetchMock.mock.calls[0][0]).toBe("/api/hotel-bookings/hb1/cancel");
  expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  expect(toast.success).toHaveBeenCalledWith("Reservation cancelled");
});

// source: Excel HTL-21 - "as a whole ... Partial cancellation is not supported": no per-room cancel
test("there is one cancel action for the whole reservation, none per room", () => {
  render(<HotelBookingDetails booking={booking} now={NOW} />);
  expect(screen.getAllByRole("button", { name: /cancel/i }).map((b) => b.textContent)).toEqual(["Cancel reservation"]);
});

// source: Excel HTL-21 - cancel "before the check-in date"
test("from the check-in date there is no cancel button, just the reason", () => {
  const reason = "The check-in date has been reached; the reservation can no longer be cancelled.";
  render(
    <HotelBookingDetails
      booking={{ ...booking, cancellation: { ...booking.cancellation, cancellable: false, reason, refundAmount: 0, refundPercentage: 0 } }}
      now={NOW}
    />,
  );
  expect(screen.queryByRole("button", { name: "Cancel reservation" })).toBeNull();
  expect(screen.getByText(reason)).toBeDefined();
});

// source: team leader decision 24 Nov - Pending Payment: "Continue payment" to /checkout/{type}/{id} while the hold lasts
test("a reservation waiting for payment links to the payment while the hold lasts", () => {
  const waiting = { ...booking, status: "pending_payment", reference: null, payment: null, holdExpiresAt: "2027-02-01T10:05:00.000Z" };
  render(<HotelBookingDetails booking={waiting} now={NOW} />);
  expect(screen.getByRole("link", { name: "Continue payment" }).getAttribute("href")).toBe("/checkout/hotel/hb1");
  expect(screen.queryByRole("button", { name: "Cancel reservation" })).toBeNull();
});

// source: Excel HTL-23 - review a Completed reservation, later edit or delete it; openapi HotelBookingDetails.review
test("a Completed reservation shows the user's review from the details with Edit and Delete", () => {
  const completed = {
    ...booking,
    status: "completed",
    cancellation: { ...booking.cancellation, cancellable: false, reason: "Only a Confirmed reservation can be cancelled." },
    review: { id: "rv1", rating: 5, text: "Lovely stay", author: { name: "Mona" }, date: "2027-03-05T10:00:00.000Z", reply: null, hidden: false },
  };
  render(<HotelBookingDetails booking={completed} now={NOW} />);
  const section = screen.getByRole("region", { name: "Your review" });
  expect(section.textContent).toContain("Lovely stay");
  expect(screen.getByRole("button", { name: "Edit" })).toBeDefined();
});

// source: team leader (Q3) - a Confirmed reservation shows the review hint
test("a Confirmed reservation shows the review hint", () => {
  render(<HotelBookingDetails booking={booking} now={NOW} />);
  expect(screen.getByText("You can review your stay after check-out.")).toBeDefined();
});
