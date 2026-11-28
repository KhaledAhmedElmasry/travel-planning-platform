// Date range form of the hotel availability calendar (HTL-08 "for a chosen date range").
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }) }));

import { AvailabilityRangeForm } from "./availability-range-form";

afterEach(() => {
  cleanup();
  push.mockReset();
});

const submit = () => fireEvent.click(screen.getByRole("button", { name: "Show availability" }));

// source: Excel HTL-08 "view each room's status for a chosen date range" - submitting shows the chosen range
test("submitting a chosen range opens the availability for exactly those dates", () => {
  render(<AvailabilityRangeForm from="2027-03-01" to="2027-03-10" />);
  submit();
  expect(push).toHaveBeenCalledTimes(1);
  const url = String(push.mock.calls[0][0]);
  expect(url.startsWith("/hotel/availability")).toBe(true);
  expect(url).toContain("2027-03-01");
  expect(url).toContain("2027-03-10");
});

// source: Excel GEN-16 "prevent common input errors, and provide understandable error messages"; GEN-02 errors at the field
test("without a chosen range nothing is loaded and the dates field is marked invalid with a message", () => {
  render(<AvailabilityRangeForm from="" to="" />);
  submit();
  expect(push).not.toHaveBeenCalled();
  const field = screen.getByRole("button", { name: /Dates/ });
  expect(field.getAttribute("aria-invalid")).toBe("true");
  const messageId = field.getAttribute("aria-describedby") ?? "";
  expect(document.getElementById(messageId)?.textContent?.trim()).toBeTruthy();
});
