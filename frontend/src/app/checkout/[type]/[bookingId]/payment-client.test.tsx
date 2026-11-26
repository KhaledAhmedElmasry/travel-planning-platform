// P-16 client part (PAY-01, PAY-02). A booking whose policies are not accepted yet (the user left the
// booking wizard before the policy step, then came back with "Continue payment") shows the policy step
// first; the card form appears only after acceptance, because the backend refuses payment until then.
// A cancelled or completed booking opened by URL says it no longer waits for payment.
// Faked: fetch (backend), Stripe's React library (external service), the Next.js router.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { BookingPolicies } from "@/components/app/checkout/policy-acceptance";

vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: ReactNode }) => children,
  CardElement: () => <div data-testid="card-element" />,
  useStripe: () => ({ confirmCardPayment: vi.fn() }),
  useElements: () => ({ getElement: () => null }),
}));
vi.mock("@stripe/stripe-js", () => ({ loadStripe: () => Promise.resolve(null) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { NoLongerPayable, PaymentClient } from "./payment-client";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// source: openapi BookingPoliciesResponse (GET /api/bookings/{type}/{id}/policies)
const policies = (acceptedAt: string | null): BookingPolicies => ({
  bookingType: "hotel",
  bookingId: "h1",
  currency: "USD",
  acceptedAt,
  policies: {
    bookingType: "hotel",
    hotel: { id: "x", name: "Nile View Hotel" },
    cancellationTiers: [{ daysBefore: 3, refundPercentage: 100 }],
    checkInTime: "14:00",
    checkOutTime: "12:00",
  },
});

const base = {
  bookingType: "hotel" as const,
  bookingId: "h1",
  amount: 30000,
  currency: "USD",
  holdExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
};

// source: Excel PAY-02 - "Payment is blocked until the user accepts the policies"
test("policies not accepted yet: the policy step shows and the card form waits for the acceptance", async () => {
  const fetchMock = vi.fn().mockResolvedValue(json(200, { acceptedAt: "2026-11-26T10:00:00.000Z" }));
  vi.stubGlobal("fetch", fetchMock);
  render(<PaymentClient {...base} policies={policies(null)} />);

  expect(screen.getByRole("region", { name: /Nile View Hotel policies/ })).toBeTruthy();
  expect(screen.queryByTestId("card-element")).toBeNull();

  fireEvent.click(screen.getByRole("checkbox", { name: "I have read and accept these policies" }));

  expect(await screen.findByTestId("card-element")).toBeTruthy();
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("/api/bookings/hotel/h1/accept-policies");
  expect(init.method).toBe("POST");
  expect(JSON.parse(init.body as string)).toEqual({ accepted: true });
});

test("policies already accepted: the card form shows straight away, no policy step", () => {
  render(<PaymentClient {...base} policies={policies("2026-11-26T09:55:00.000Z")} />);

  expect(screen.getByTestId("card-element")).toBeTruthy();
  expect(screen.queryByRole("checkbox")).toBeNull();
});

// source: Excel GEN-11 - Cancelled and Completed are final states, not payable
test("a cancelled booking opened by URL says it no longer waits for payment and links to its details", () => {
  render(<NoLongerPayable bookingType="flight" bookingId="b1" status="cancelled" />);

  expect(screen.getByText("This booking is no longer waiting for payment.")).toBeTruthy();
  expect(screen.getByText(/cancelled/i)).toBeTruthy();
  expect(screen.getByRole("link", { name: "View booking details" }).getAttribute("href")).toBe("/bookings/flights/b1");
  expect(screen.queryByText(/hold expired/i)).toBeNull();
});
