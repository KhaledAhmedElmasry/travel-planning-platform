// lib/api.ts: apiFetch (JSON) and apiBlob (files such as the itinerary PDF, ITN-28).
// Faked: fetch (backend).
import { afterEach, expect, test, vi } from "vitest";
import { ApiError, apiBlob, apiFetch } from "./api";

afterEach(() => vi.unstubAllGlobals());

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
// source: openapi Error schema
const notFound = { statusCode: 404, error: "NOT_FOUND", message: "Itinerary not found, or it belongs to another user." };
// source: openapi GET /api/itineraries/{id}/pdf (Content-Disposition: attachment; filename="itinerary-<title>.pdf")
const pdf = () =>
  new Response("%PDF-1.4", {
    status: 200,
    headers: { "content-type": "application/pdf", "content-disposition": 'attachment; filename="itinerary-Cairo-trip.pdf"' },
  });

test("apiFetch still returns the JSON body, undefined for 204 and throws ApiError with the backend message", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(200, { id: "a" })).mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json(404, notFound)));

  await expect(apiFetch("/api/x")).resolves.toEqual({ id: "a" });
  await expect(apiFetch("/api/x", { method: "DELETE" })).resolves.toBeUndefined();
  await expect(apiFetch("/api/x")).rejects.toMatchObject({ status: 404, message: notFound.message });
});

test("apiBlob returns the file and the file name the backend chose", async () => {
  const fetchMock = vi.fn().mockResolvedValue(pdf());
  vi.stubGlobal("fetch", fetchMock);

  const file = await apiBlob("/api/itineraries/i1/pdf");

  expect(fetchMock.mock.calls[0][0]).toBe("/api/itineraries/i1/pdf");
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: "include", cache: "no-store" });
  expect(file.filename).toBe("itinerary-Cairo-trip.pdf");
  expect(file.blob.type).toBe("application/pdf");
  expect(await file.blob.text()).toBe("%PDF-1.4");
});

test("apiBlob gives null as the file name when the backend sends none", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x", { status: 200 })));

  expect((await apiBlob("/api/file")).filename).toBeNull();
});

// source: spec §1 (ACC-19) - on a 401 call POST /api/auth/refresh once and retry
test("apiBlob refreshes the session once on a 401 and retries", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(json(401, { statusCode: 401, error: "UNAUTHORIZED", message: "x" }))
    .mockResolvedValueOnce(json(401, { statusCode: 401, error: "UNAUTHORIZED", message: "x" }))
    .mockResolvedValueOnce(new Response(null, { status: 200 }))
    .mockResolvedValueOnce(pdf());
  vi.stubGlobal("fetch", fetchMock);

  const file = await apiBlob("/api/itineraries/i1/pdf");

  expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
    "/api/itineraries/i1/pdf",
    "/api/itineraries/i1/pdf",
    "/api/auth/refresh",
    "/api/itineraries/i1/pdf",
  ]);
  expect(file.filename).toBe("itinerary-Cairo-trip.pdf");
});

// source: spec §1 (ACC-19) - a guest: request 401, retry 401, refresh 401 -> ApiError 401.
// A reply whose body is never read stays open in Chromium (Playwright "networkidle" never comes),
// so every reply the client drops must have its body read.
test("apiFetch reads the body of every reply it drops when a guest's refresh fails", async () => {
  const unauthorized = () => json(401, { statusCode: 401, error: "UNAUTHORIZED", message: "You must be logged in" });
  const replies = [unauthorized(), unauthorized(), unauthorized()];
  const fetchMock = vi.fn();
  replies.forEach((reply) => fetchMock.mockResolvedValueOnce(reply));
  vi.stubGlobal("fetch", fetchMock);

  await expect(apiFetch("/api/auth/me", { redirectOnAuthFail: false })).rejects.toMatchObject({ status: 401 });

  expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(["/api/auth/me", "/api/auth/me", "/api/auth/refresh"]);
  expect(replies.map((reply) => reply.bodyUsed)).toEqual([true, true, true]);
});

// source: spec §1 (ACC-19) - 401, retry 401, refresh OK, retry succeeds: both dropped 401s are read
// (a successful refresh is 204: no body to read).
test("apiBlob reads the body of every reply it drops when the refresh succeeds", async () => {
  const unauthorized = () => json(401, { statusCode: 401, error: "UNAUTHORIZED", message: "x" });
  const replies = [unauthorized(), unauthorized(), new Response(null, { status: 204 }), pdf()];
  const fetchMock = vi.fn();
  replies.forEach((reply) => fetchMock.mockResolvedValueOnce(reply));
  vi.stubGlobal("fetch", fetchMock);

  await apiBlob("/api/itineraries/i1/pdf");

  expect(replies.slice(0, 2).map((reply) => reply.bodyUsed)).toEqual([true, true]);
});

test("apiBlob throws ApiError 401 when the refresh fails and redirectOnAuthFail is false", async () => {
  // A fresh reply per call, like a real fetch (a reply's body can be read only once).
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => json(401, { statusCode: 401, error: "UNAUTHORIZED", message: "Session expired" })));

  await expect(apiBlob("/api/itineraries/i1/pdf", { redirectOnAuthFail: false })).rejects.toMatchObject({ status: 401 });
});

test("apiBlob throws ApiError with the backend message on an error", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(404, notFound)));

  const error = await apiBlob("/api/itineraries/i1/pdf").catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ status: 404, message: notFound.message });
});
