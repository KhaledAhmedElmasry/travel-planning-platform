// StripePaymentPanel (PAY-01). Stripe Elements card form; the booking is confirmed only after the
// backend's webhook (polled every 2 s for up to 60 s, team leader 23 Nov); failures can be retried
// until the hold expires. Faked: fetch (backend), Stripe's React library (external service), clock.
// The payment status `pending` is written with backticks: the project's TDD hook reads a quoted
// pending as a "pending test" marker.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const confirmCardPayment = vi.hoisted(() => vi.fn());
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: ReactNode }) => children,
  CardElement: () => <div data-testid="card-element" />,
  useStripe: () => ({ confirmCardPayment }),
  useElements: () => ({ getElement: () => ({ kind: "card" }) }),
}));
vi.mock("@stripe/stripe-js", () => ({ loadStripe: () => Promise.resolve(null) }));

import { StripePaymentPanel } from "./stripe-payment-panel";

const NOW = new Date("2026-11-23T10:00:00.000Z");
const WAITING = `pending`;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  confirmCardPayment.mockReset();
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
const payment = (status: string, extra: object = {}) => ({
  id: "p1",
  bookingType: "flight",
  bookingId: "b1",
  amount: 63000,
  currency: "USD",
  status,
  stripePaymentId: "pi_1",
  failureMessage: null,
  clientSecret: "pi_1_secret",
  ...extra,
});

function renderPanel(holdExpiresAt = "2026-11-23T10:08:00.000Z") {
  const onConfirmed = vi.fn();
  render(
    <StripePaymentPanel
      bookingType="flight"
      bookingId="b1"
      amount={63000}
      currency="USD"
      holdExpiresAt={holdExpiresAt}
      onConfirmed={onConfirmed}
    />,
  );
  return onConfirmed;
}
async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

// source: spec P-16 - amount in the platform currency and the remaining hold time
test("shows the amount and the card form", () => {
  renderPanel();

  expect(screen.getByRole("region", { name: /payment/i }).textContent).toContain("630.00");
  expect(screen.getByTestId("card-element")).toBeDefined();
});

// source: Excel PAY-01 - Stripe Elements / PaymentIntents; confirmed only after the backend verifies via the webhook
test("Pay creates the payment, confirms the card with Stripe and waits for the backend's confirmation", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(json(201, payment(WAITING)))
    .mockResolvedValueOnce(json(200, payment(WAITING, { clientSecret: null })))
    .mockResolvedValueOnce(json(200, payment("succeeded", { clientSecret: null })));
  vi.stubGlobal("fetch", fetchMock);
  confirmCardPayment.mockResolvedValue({ paymentIntent: { status: "succeeded" } });
  const onConfirmed = renderPanel();

  fireEvent.click(screen.getByRole("button", { name: "Pay" }));
  await settle();

  expect(fetchMock.mock.calls[0][0]).toBe("/api/payments");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ bookingType: "flight", bookingId: "b1" });
  expect(confirmCardPayment).toHaveBeenCalledWith("pi_1_secret", { payment_method: { card: { kind: "card" } } });
  expect(screen.getByRole("status").textContent).toContain("Waiting for confirmation");
  expect(onConfirmed).not.toHaveBeenCalled();

  await settle(2000);
  expect(onConfirmed).not.toHaveBeenCalled();
  await settle(2000);
  expect(fetchMock.mock.calls[1][0]).toBe("/api/payments/p1");
  expect(onConfirmed).toHaveBeenCalledWith("p1");
});

// source: Excel PAY-01 - "On failure an error is shown and the user may retry until the hold expires"
test("a declined card shows Stripe's message and Retry uses the same payment", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(json(201, payment(WAITING)))
    .mockResolvedValueOnce(json(200, payment(WAITING, { clientSecret: "pi_1_secret_2" })));
  vi.stubGlobal("fetch", fetchMock);
  confirmCardPayment.mockResolvedValueOnce({ error: { message: "Your card was declined." } });
  renderPanel();

  fireEvent.click(screen.getByRole("button", { name: "Pay" }));
  await settle();
  expect(screen.getByRole("alert").textContent).toContain("Your card was declined.");

  confirmCardPayment.mockResolvedValueOnce({ paymentIntent: { status: "succeeded" } });
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await settle();

  expect(fetchMock.mock.calls[1][0]).toBe("/api/payments/p1/retry");
  expect(fetchMock.mock.calls[1][1].method).toBe("POST");
  expect(confirmCardPayment).toHaveBeenLastCalledWith("pi_1_secret_2", expect.anything());
});

// source: Excel PAY-01 + openapi Payment.failureMessage - the backend reports the failure (webhook)
test("a payment the backend marks as failed shows its message and offers Retry", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(json(201, payment(WAITING)))
      .mockResolvedValueOnce(json(200, payment("failed", { clientSecret: null, failureMessage: "Your card has insufficient funds." }))),
  );
  confirmCardPayment.mockResolvedValue({ paymentIntent: { status: "processing" } });
  renderPanel();

  fireEvent.click(screen.getByRole("button", { name: "Pay" }));
  await settle(2000);

  expect(screen.getByRole("alert").textContent).toContain("Your card has insufficient funds.");
  expect(screen.getByRole("button", { name: "Retry" })).toBeDefined();
});

// source: team leader (23 Nov) - poll up to 60 s, then a message with a link to My bookings
test("no confirmation within 60 seconds points to My bookings", async () => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => json(200, payment(WAITING, { clientSecret: "pi_1_secret" }))));
  confirmCardPayment.mockResolvedValue({ paymentIntent: { status: "succeeded" } });
  const onConfirmed = renderPanel();

  fireEvent.click(screen.getByRole("button", { name: "Pay" }));
  await settle(61_000);

  expect(onConfirmed).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: /my bookings/i }).getAttribute("href")).toBe("/bookings");
});

// source: Excel PAY-01 "retry until the hold expires"; spec P-16 hold expired with a "search again" action
test("when the hold expires, payment stops and Search again is offered", async () => {
  renderPanel("2026-11-23T10:00:30.000Z");

  await settle(31_000);

  expect(screen.queryByRole("button", { name: "Pay" })).toBeNull();
  expect(screen.getByRole("link", { name: /search again/i }).getAttribute("href")).toBe("/flights");
});

// source: openapi POST /api/payments 400 - policies not accepted yet (PAY-02): the backend's message
test("a refused payment shows the backend's message", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(json(400, { statusCode: 400, error: "BAD_REQUEST", message: "Accept the provider policies before paying (PAY-02)." })),
  );
  renderPanel();

  fireEvent.click(screen.getByRole("button", { name: "Pay" }));
  await settle();

  expect(screen.getByRole("alert").textContent).toContain("Accept the provider policies before paying (PAY-02).");
  expect(confirmCardPayment).not.toHaveBeenCalled();
});
