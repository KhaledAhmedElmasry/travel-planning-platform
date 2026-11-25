// latestRefund(): the booking details pages P-21 / P-23 read the refund with GET /api/refunds/{id}.
// Faked: the network (fetch) and the request cookies; backendJson() is the real one.
import { afterEach, expect, test, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ toString: () => "access_token=abc" }) }));
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { BACKEND_URL } from "./backend";
import { latestRefund } from "./refund";

afterEach(() => fetchMock.mockReset());

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// Refund as carried by GET /api/{flight|hotel}-bookings/{id} (status Failed, PAY-03)
const FROM_DETAILS = { id: "r1/x", amount: 5000, currency: "USD", refundPercentage: 50, status: "failed" };

// source: .md 8.7 "GET /api/refunds/:id PAY-03"; PAY-03 "show its status (Pending, Refunded, Failed) on the booking details"
test("reads the refund with GET /api/refunds/{id} and returns that reply", async () => {
  const fromEndpoint = { ...FROM_DETAILS, status: "refunded" };
  fetchMock.mockResolvedValue(json(200, fromEndpoint));

  expect(await latestRefund(FROM_DETAILS)).toEqual(fromEndpoint);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe(`${BACKEND_URL}/api/refunds/r1%2Fx`);
});

// source: PAY-03 - a refund exists for "every cancellation with a positive refund amount"; no refund = nothing to read
test("no refund on the booking: no call, null", async () => {
  expect(await latestRefund(null)).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});

// source: team leader answer (25 Nov): when GET /api/refunds/{id} gives no data, show the refund from the details
test.each([401, 403, 404])("answer %i: falls back to the refund from the details", async (status) => {
  fetchMock.mockResolvedValue(json(status, { statusCode: status, message: "Refund not found." }));

  expect(await latestRefund(FROM_DETAILS)).toEqual(FROM_DETAILS);
});

// source: team leader answer (25 Nov): other errors show the page's error screen like every other read
test("answer 500: throws so the page shows its error screen", async () => {
  fetchMock.mockResolvedValue(json(500, { statusCode: 500 }));

  await expect(latestRefund(FROM_DETAILS)).rejects.toThrow("GET /api/refunds/r1%2Fx failed with 500");
});
