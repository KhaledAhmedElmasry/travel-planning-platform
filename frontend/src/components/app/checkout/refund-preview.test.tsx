// RefundPreview (FLT-26, HTL-21): before confirming a cancellation the user sees the refund computed
// from the provider's tiers (openapi CancellationPreview, the same calculation the cancel uses).
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { RefundPreview } from "./refund-preview";

afterEach(cleanup);

// source: Excel FLT-26 "after viewing the refund amount computed from the airline's tiers"
test("a cancellable booking shows the refund amount, the percentage and the days left", () => {
  render(
    <RefundPreview
      kind="flight"
      preview={{ cancellable: true, reason: null, daysBefore: 12, refundPercentage: 50, tierDaysBefore: 7, refundAmount: 31500, currency: "USD" }}
    />,
  );

  const text = screen.getByRole("region", { name: /refund/i }).textContent!;
  expect(text).toContain("315.00");
  expect(text).toContain("50%");
  expect(text).toContain("12 days before departure");
});

// source: Excel HTL-21 - refund computed from the hotel's tiers on the full total; days before check-in
test("a hotel preview counts the days before check-in", () => {
  render(
    <RefundPreview
      kind="hotel"
      preview={{ cancellable: true, reason: null, daysBefore: 5, refundPercentage: 100, tierDaysBefore: 3, refundAmount: 49500, currency: "USD" }}
    />,
  );

  expect(screen.getByRole("region", { name: /refund/i }).textContent).toContain("5 days before check-in");
});

// source: openapi CancellationPreview - refundPercentage 0 when no tier applies (PAY-03: no refund)
test("no tier means no refund, said plainly", () => {
  render(
    <RefundPreview
      kind="flight"
      preview={{ cancellable: true, reason: null, daysBefore: 1, refundPercentage: 0, tierDaysBefore: null, refundAmount: 0, currency: "USD" }}
    />,
  );

  expect(screen.getByRole("region", { name: /refund/i }).textContent).toContain("No refund");
});

// source: Excel FLT-26 "Cancellation after departure is blocked"; openapi reason
test("a booking that can't be cancelled shows the backend's reason", () => {
  render(
    <RefundPreview
      kind="flight"
      preview={{ cancellable: false, reason: "The flight has already departed.", daysBefore: null, refundPercentage: 0, tierDaysBefore: null, refundAmount: 0, currency: "USD" }}
    />,
  );

  expect(screen.getByRole("region", { name: /refund/i }).textContent).toContain("The flight has already departed.");
});
