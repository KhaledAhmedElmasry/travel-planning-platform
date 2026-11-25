// PolicyAcceptance (PAY-02). Shows the provider's policies and a mandatory acceptance checkbox
// (label "I have read and accept these policies", team leader 23 Nov); ticking it saves the
// acceptance (POST accept-policies). Only fetch is faked.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { PolicyAcceptance, type BookingPolicies } from "./policy-acceptance";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// source: openapi BookingPoliciesResponse + FlightBookingPolicies (FLT-08 baggage, FLT-09 tiers)
const flightPolicies: BookingPolicies = {
  bookingType: "flight",
  bookingId: "b1",
  currency: "USD",
  acceptedAt: null,
  policies: {
    bookingType: "flight",
    airline: { id: "a1", name: "Nile Air" },
    cancellationTiers: [
      { daysBefore: 30, refundPercentage: 100 },
      { daysBefore: 7, refundPercentage: 50 },
    ],
    baggage: {
      cabins: [{ flightId: "f1", flightNumber: "NA101", cabinClass: "economy", freeBags: 1, maxBagWeightKg: 23 }],
      extraBagPrice: 5000,
      maxExtraBagsPerPassenger: 2,
    },
  },
};
// source: openapi HotelBookingPolicies (HTL-09 times, HTL-10 tiers)
const hotelPolicies: BookingPolicies = {
  bookingType: "hotel",
  bookingId: "h1",
  currency: "USD",
  acceptedAt: null,
  policies: {
    bookingType: "hotel",
    hotel: { id: "x", name: "Nile View Hotel" },
    cancellationTiers: [{ daysBefore: 3, refundPercentage: 100 }],
    checkInTime: "14:00",
    checkOutTime: "12:00",
  },
};

// source: Excel PAY-02 - airline: cancellation and baggage policies
test("a flight booking shows the airline's cancellation tiers and baggage policy", () => {
  render(<PolicyAcceptance data={flightPolicies} onAccepted={vi.fn()} />);

  const text = screen.getByRole("region", { name: /policies/i }).textContent!;
  expect(text).toContain("Nile Air");
  expect(text).toContain("30");
  expect(text).toContain("100%");
  expect(text).toContain("50%");
  expect(text).toContain("NA101");
  expect(text).toContain("23 kg");
  expect(text).toContain("50.00");
});

// source: Excel PAY-02 - hotel: cancellation policy and check-in/check-out times
test("a hotel reservation shows the hotel's tiers and check-in/check-out times", () => {
  render(<PolicyAcceptance data={hotelPolicies} onAccepted={vi.fn()} />);

  const text = screen.getByRole("region", { name: /policies/i }).textContent!;
  expect(text).toContain("Nile View Hotel");
  expect(text).toContain("14:00");
  expect(text).toContain("12:00");
  expect(text).toContain("100%");
});

// source: Excel PAY-02 - acceptance checkbox, acceptance stored with a timestamp
test("ticking the checkbox saves the acceptance and reports it", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { bookingType: "flight", bookingId: "b1", acceptedAt: "2026-11-23T10:00:00.000Z" }));
  vi.stubGlobal("fetch", fetchMock);
  const onAccepted = vi.fn();
  render(<PolicyAcceptance data={flightPolicies} onAccepted={onAccepted} />);

  fireEvent.click(screen.getByRole("checkbox", { name: "I have read and accept these policies" }));

  await waitFor(() => expect(onAccepted).toHaveBeenCalledWith("2026-11-23T10:00:00.000Z"));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/bookings/flight/b1/accept-policies");
  expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ accepted: true });
});

// source: Excel PAY-02 - "acceptance is stored": an accepted booking shows it ticked and cannot be unticked
test("an already accepted booking shows the box ticked and locked", () => {
  render(<PolicyAcceptance data={{ ...flightPolicies, acceptedAt: "2026-11-23T10:00:00.000Z" }} onAccepted={vi.fn()} />);

  const box = screen.getByRole("checkbox", { name: "I have read and accept these policies" });
  expect(box.getAttribute("aria-checked")).toBe("true");
  expect(box.hasAttribute("disabled")).toBe(true);
});

// source: openapi accept-policies 409 (not pending payment / hold expired) - the backend's message is shown
test("a refused acceptance shows the backend's message and leaves the box unticked", async () => {
  const message = "This booking is expired, not pending payment.";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(409, { statusCode: 409, error: "CONFLICT", message })));
  const onAccepted = vi.fn();
  render(<PolicyAcceptance data={flightPolicies} onAccepted={onAccepted} />);

  const box = screen.getByRole("checkbox", { name: "I have read and accept these policies" });
  fireEvent.click(box);

  expect((await screen.findByRole("alert")).textContent).toContain(message);
  expect(box.getAttribute("aria-checked")).toBe("false");
  expect(onAccepted).not.toHaveBeenCalled();
});

// source: Excel PAY-02 (policies shown before payment); tip text chosen by Khaled (popup, 25 Nov 2026)
test("So3ad's tip asks to read the refund tiers first", () => {
  const { container } = render(<PolicyAcceptance data={flightPolicies} onAccepted={vi.fn()} />);

  expect(screen.getByText("“Read the refund tiers first, habibi.”")).toBeDefined();
  expect(container.querySelector('svg[data-pose="avatar"]')).not.toBeNull();
});
