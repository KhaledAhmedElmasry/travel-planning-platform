// P-46 hotel policies form (HTL-09 check-in / check-out times, HTL-10 cancellation tiers).
// Faked: fetch (backend) and the Next.js router.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

import { PoliciesForm, type HotelPolicies } from "./policies-form";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// Tiers listed with the most days first, so the row on screen = the index in the array.
const initial: HotelPolicies = {
  checkInTime: "14:00",
  checkOutTime: "12:00",
  cancellationTiers: [
    { daysBefore: 7, refundPercentage: 100 },
    { daysBefore: 2, refundPercentage: 50 },
  ],
};

const days = () => screen.getAllByLabelText("Days before check-in") as HTMLInputElement[];
const refunds = () => screen.getAllByLabelText("Refund %") as HTMLInputElement[];
const save = () => fireEvent.click(screen.getByRole("button", { name: "Save policies" }));
const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body as string);

function renderForm(values: HotelPolicies = initial) {
  render(<PoliciesForm hotelId="h1" initial={values} />);
}

// source: PDF .md section 8 "PUT /api/hotels/:id/policies" (HTL-09, HTL-10); Excel HTL-09 "set the hotel's standard
// check-in and check-out times"; Excel HTL-10 "define cancellation tiers"
test("saving sends the entered times and tiers with PUT /api/hotels/{id}/policies", async () => {
  fetchMock.mockResolvedValue(json(200, {}));
  renderForm();

  fireEvent.change(screen.getByLabelText(/Check-in time/), { target: { value: "15:30" } });
  fireEvent.change(screen.getByLabelText(/Check-out time/), { target: { value: "11:00" } });
  fireEvent.change(days()[1], { target: { value: "3" } });
  fireEvent.change(refunds()[1], { target: { value: "40" } });
  save();

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/hotels/h1/policies");
  expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
  expect(sentBody()).toEqual({
    checkInTime: "15:30",
    checkOutTime: "11:00",
    cancellationTiers: [
      { daysBefore: 7, refundPercentage: 100 },
      { daysBefore: 3, refundPercentage: 40 },
    ],
  });
});

// source: Excel GEN-14 "... without losing unrelated data"; PDF .md section 8 PUT (replaces the policies)
test("changing only the check-out time keeps the check-in time and every tier in the saved policies", async () => {
  fetchMock.mockResolvedValue(json(200, {}));
  renderForm();

  fireEvent.change(screen.getByLabelText(/Check-out time/), { target: { value: "10:00" } });
  save();

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(sentBody()).toEqual({ ...initial, checkOutTime: "10:00" });
});

// source: Excel HTL-10 "each with a unique days-before-check-in threshold"; Excel GEN-02 field-level messages
test("two tiers with the same days are not saved and the duplicate row is marked invalid", () => {
  renderForm();

  fireEvent.change(days()[1], { target: { value: "7" } });
  save();

  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByLabelText(/Check-in time/).getAttribute("aria-invalid")).toBeNull();
  expect([days()[0], days()[1]].some((input) => input.getAttribute("aria-invalid") === "true")).toBe(true);
});

// source: Excel HTL-10 "days-before-check-in threshold (integer >=0)"
test("a negative number of days is not saved", () => {
  renderForm();

  fireEvent.change(days()[1], { target: { value: "-1" } });
  save();

  expect(fetchMock).not.toHaveBeenCalled();
  expect(days()[1].getAttribute("aria-invalid")).toBe("true");
});

// source: Excel HTL-10 "threshold (integer >=0)"
test("a number of days that is not a whole number is not saved", () => {
  renderForm();

  fireEvent.change(days()[1], { target: { value: "1.5" } });
  save();

  expect(fetchMock).not.toHaveBeenCalled();
  expect(days()[1].getAttribute("aria-invalid")).toBe("true");
});

// source: Excel HTL-10 "a refund percentage (0-100%)"
test("a refund above 100% is not saved", () => {
  renderForm();

  fireEvent.change(refunds()[0], { target: { value: "101" } });
  save();

  expect(fetchMock).not.toHaveBeenCalled();
  expect(refunds()[0].getAttribute("aria-invalid")).toBe("true");
});

// source: Excel HTL-10 "a refund percentage (0-100%)"
test("a negative refund is not saved", () => {
  renderForm();

  fireEvent.change(refunds()[1], { target: { value: "-5" } });
  save();

  expect(fetchMock).not.toHaveBeenCalled();
  expect(refunds()[1].getAttribute("aria-invalid")).toBe("true");
});

// source: Excel HTL-10 "threshold (integer >=0)" and "refund percentage (0-100%)": 0 days, 0% and 100% are allowed
test("the limits 0 days, 0% and 100% are saved", async () => {
  fetchMock.mockResolvedValue(json(200, {}));
  renderForm();

  fireEvent.change(refunds()[0], { target: { value: "100" } });
  fireEvent.change(days()[1], { target: { value: "0" } });
  fireEvent.change(refunds()[1], { target: { value: "0" } });
  save();

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(sentBody().cancellationTiers).toEqual([
    { daysBefore: 7, refundPercentage: 100 },
    { daysBefore: 0, refundPercentage: 0 },
  ]);
});

// source: Excel HTL-09 "set the hotel's standard check-in and check-out times"; Excel GEN-02 field-level messages
test("an empty check-in time is not saved and the check-in field is marked invalid", () => {
  renderForm();

  fireEvent.change(screen.getByLabelText(/Check-in time/), { target: { value: "" } });
  save();

  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByLabelText(/Check-in time/).getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByLabelText(/Check-out time/).getAttribute("aria-invalid")).toBeNull();
});

// source: Excel GEN-02 "field-level validation messages on all forms" (the backend's message under its field)
test("a backend error on the check-out time is shown under the check-out field", async () => {
  fetchMock.mockResolvedValue(
    json(400, {
      statusCode: 400,
      error: "Bad Request",
      message: "Validation failed",
      fieldErrors: [{ field: "checkOutTime", messages: ["checkOutTime must be HH:mm"] }],
    }),
  );
  renderForm();

  save();

  const field = screen.getByLabelText(/Check-out time/);
  await waitFor(() => expect(field.getAttribute("aria-invalid")).toBe("true"));
  const describedBy = field.getAttribute("aria-describedby")!.split(" ");
  expect(describedBy.some((id) => document.getElementById(id)?.textContent?.includes("checkOutTime must be HH:mm"))).toBe(true);
  expect(screen.getByLabelText(/Check-in time/).getAttribute("aria-invalid")).toBeNull();
});

// source: Excel GEN-02 "field-level validation messages on all forms" (a tier error stays on its own tier row)
test("a backend error on the second tier is shown on that tier's row only", async () => {
  fetchMock.mockResolvedValue(
    json(400, {
      statusCode: 400,
      error: "Bad Request",
      message: "Validation failed",
      fieldErrors: [{ field: "cancellationTiers.1.refundPercentage", messages: ["refund rejected"] }],
    }),
  );
  renderForm();

  save();

  await waitFor(() => expect(refunds()[1].getAttribute("aria-invalid")).toBe("true"));
  expect(document.getElementById(refunds()[1].getAttribute("aria-describedby")!)?.textContent).toBe("refund rejected");
  expect(refunds()[0].getAttribute("aria-invalid")).toBeNull();
});

// source: Excel GEN-14 "cancel actions where applicable without losing unrelated data"
test("Discard changes puts back the saved times and tiers without saving", () => {
  renderForm();

  fireEvent.change(screen.getByLabelText(/Check-in time/), { target: { value: "16:00" } });
  fireEvent.change(refunds()[1], { target: { value: "25" } });
  fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

  expect(fetchMock).not.toHaveBeenCalled();
  expect((screen.getByLabelText(/Check-in time/) as HTMLInputElement).value).toBe("14:00");
  expect(days().map((input) => input.value)).toEqual(["7", "2"]);
  expect(refunds().map((input) => input.value)).toEqual(["100", "50"]);
});
