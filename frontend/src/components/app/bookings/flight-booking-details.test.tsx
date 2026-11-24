// P-21 Flight booking details (FLT-25, FLT-26, PAY-03, FLT-23, GEN-03). Fetch, the router and the toast are faked.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { FlightBookingDetails, type FlightBookingDetailsData } from "./flight-booking-details";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toast.success.mockReset();
  toast.error.mockReset();
  router.refresh.mockReset();
});

const NOW = new Date("2027-02-01T10:00:00.000Z");

// source: backend flight-bookings.controller.ts details() = toResponse() + payment, refund, cancellation; Mock Data airports CAI, DXB
const booking: FlightBookingDetailsData = {
  id: "fb1",
  reference: "TP7K2Q",
  status: "confirmed",
  holdExpiresAt: null,
  segments: [
    {
      flightId: "f1",
      flightNumber: "NA101",
      airlineName: "Nile Air",
      cabinClass: "economy",
      departureAirport: "CAI",
      arrivalAirport: "DXB",
      departureLocal: "2027-03-01 08:00 (Africa/Cairo)",
      arrivalLocal: "2027-03-01 13:30 (Asia/Dubai)",
      freeBags: 1,
      maxBagWeightKg: 23,
    },
  ],
  passengers: [
    { type: "adult", fullName: "Mona Adel", extraBags: [{ weightKg: 23 }], fare: 30000, baggageFee: 5000 },
    { type: "infant", fullName: "Laila Adel", extraBags: [], fare: 3000, baggageFee: 0 },
  ],
  totalAmount: 38000,
  currency: "USD",
  payment: { status: "succeeded" },
  refund: null,
  cancellation: {
    cancellable: true,
    reason: null,
    daysBefore: 27,
    refundPercentage: 50,
    tierDaysBefore: 14,
    refundAmount: 19000,
    currency: "USD",
  },
};

function cancelButtonInDialog(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "Cancel booking")!;
}

// source: spec P-21 - all details: segments, local times, passengers, baggage, total, status, payment status (FLT-25, GEN-06)
test("shows the flights in local time, the passengers, the baggage, the total, the status and the payment status", () => {
  render(<FlightBookingDetails booking={booking} now={NOW} />);
  const text = document.body.textContent!;
  expect(text).toContain("TP7K2Q");
  expect(text).toContain("Nile Air · NA101 · Economy");
  expect(text).toContain("CAI Mon, 1 Mar 2027 08:00 → DXB Mon, 1 Mar 2027 13:30");
  expect(text).toContain("1 free bag up to 23 kg");
  expect(text).toContain("Mona Adel");
  expect(text).toContain("Adult");
  expect(text).toContain("1 extra bag (23 kg)");
  expect(text).toContain("Laila Adel");
  expect(text).toContain("Infant");
  expect(text).toContain("$380.00");
  expect(text).toContain("Confirmed");
  expect(text).toContain("Paid");
});

// source: Excel PAY-03 - show the refund status (Pending, Refunded, Failed) on the booking details
test("shows the refund status and amount", () => {
  render(
    <FlightBookingDetails
      booking={{
        ...booking,
        status: "cancelled",
        refund: { amount: 19000, currency: "USD", refundPercentage: 50, status: "refunded" },
      }}
      now={NOW}
    />,
  );
  const refund = screen.getByRole("region", { name: "Refund status" });
  expect(refund.textContent).toContain("Refunded");
  expect(refund.textContent).toContain("$190.00");
  expect(refund.textContent).toContain("50%");
});

// source: Excel FLT-23 - downloadable e-ticket (PDF); spec P-21 - e-ticket download (Confirmed bookings)
test("a confirmed booking has the e-ticket download, a cancelled one does not", () => {
  render(<FlightBookingDetails booking={booking} now={NOW} />);
  expect(screen.getByRole("link", { name: /e-ticket/i }).getAttribute("href")).toBe("/api/flight-bookings/fb1/e-ticket");
  cleanup();
  render(<FlightBookingDetails booking={{ ...booking, status: "cancelled" }} now={NOW} />);
  expect(screen.queryByRole("link", { name: /e-ticket/i })).toBeNull();
});

// source: Excel FLT-26 - "after viewing the refund amount computed from the airline's tiers and confirming"; GEN-03
test("cancelling shows the refund amount first and cancels after confirming", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...booking, status: "cancelled" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  render(<FlightBookingDetails booking={booking} now={NOW} />);

  fireEvent.click(screen.getByRole("button", { name: "Cancel booking" }));
  const dialog = await screen.findByRole("alertdialog");
  expect(dialog.textContent).toContain("$190.00");
  expect(dialog.textContent).toContain("50%");
  expect(fetchMock).not.toHaveBeenCalled();

  fireEvent.click(cancelButtonInDialog(dialog));
  await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  expect(fetchMock.mock.calls[0][0]).toBe("/api/flight-bookings/fb1/cancel");
  expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  expect(toast.success).toHaveBeenCalledWith("Booking cancelled");
});

// source: Excel GEN-16 - clear error feedback; ConfirmDialog stays open on error (GEN-03)
test("a refused cancellation shows the backend's message and keeps the dialog open", async () => {
  const message = "The flight has already departed; the booking cannot be cancelled.";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ statusCode: 409, error: "CONFLICT", message }), { status: 409 })));
  render(<FlightBookingDetails booking={booking} now={NOW} />);

  fireEvent.click(screen.getByRole("button", { name: "Cancel booking" }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(cancelButtonInDialog(dialog));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
  expect(router.refresh).not.toHaveBeenCalled();
  expect(screen.getByRole("alertdialog")).toBeDefined();
});

// source: Excel FLT-26 - "Cancellation after departure is blocked"
test("after departure there is no cancel button, just the reason", () => {
  const reason = "The flight has already departed; the booking cannot be cancelled.";
  render(
    <FlightBookingDetails
      booking={{ ...booking, cancellation: { ...booking.cancellation, cancellable: false, reason, refundAmount: 0, refundPercentage: 0 } }}
      now={NOW}
    />,
  );
  expect(screen.queryByRole("button", { name: "Cancel booking" })).toBeNull();
  expect(screen.getByText(reason)).toBeDefined();
});

// source: Excel FLT-26 - a Confirmed booking can be cancelled, nothing else
test("a cancelled booking has no cancel button and no reason line", () => {
  const reason = "This booking is cancelled; a confirmed booking can be cancelled.";
  render(
    <FlightBookingDetails
      booking={{ ...booking, status: "cancelled", cancellation: { ...booking.cancellation, cancellable: false, reason } }}
      now={NOW}
    />,
  );
  expect(screen.queryByRole("button", { name: "Cancel booking" })).toBeNull();
  expect(screen.queryByText(reason)).toBeNull();
});

// source: team leader decision 24 Nov - Pending Payment: "Continue payment" to /checkout/{type}/{id} while the hold lasts
test("a booking waiting for payment links to the payment while the hold lasts, not after it expired", () => {
  const waiting = { ...booking, status: "pending_payment", reference: null, payment: null, holdExpiresAt: "2027-02-01T10:05:00.000Z" };
  render(<FlightBookingDetails booking={waiting} now={NOW} />);
  expect(screen.getByRole("link", { name: "Continue payment" }).getAttribute("href")).toBe("/checkout/flight/fb1");
  cleanup();
  render(<FlightBookingDetails booking={waiting} now={new Date("2027-02-01T10:05:00.000Z")} />);
  expect(screen.queryByRole("link", { name: "Continue payment" })).toBeNull();
});
