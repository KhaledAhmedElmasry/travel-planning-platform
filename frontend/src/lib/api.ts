"use client";

// BROWSER: call the backend from Client Components (forms, buttons, likes, wizard steps).
//
//   const booking = await apiFetch<FlightBooking>("/api/flight-bookings/hold", { method: "POST", json: body });
//
// - Same origin: "/api/..." is forwarded to the backend by Next.js, cookies go along (ACC-19).
// - 401 -> refreshes the session ONCE (POST /api/auth/refresh) and retries the request (ACC-19).
//   Refreshes never run in parallel, not even across browser tabs: reusing a rotated refresh
//   token would end the whole session, so a request waits its turn and first simply retries
//   (another tab may have refreshed already).
// - Still 401 -> goes to /login?returnTo=<this page> and the promise never settles (ACC-06, ACC-10).
//   Pass { redirectOnAuthFail: false } to handle it yourself (then it throws ApiError 401).
// - Any other error -> throws ApiError with the backend's message and fieldErrors
//   (use fieldErrorMap(error.body) for the form, GEN-02).
// - Files (PDF): apiBlob(path) returns { blob, filename } with the same rules.
import { isApiError, type ApiError as ApiErrorBody } from "@/lib/api-error";
import { loginPath } from "@/lib/return-to";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody | null,
  ) {
    super(body?.message ?? `Request failed (${status})`);
    this.name = "ApiError";
  }
}

type ApiInit = Omit<RequestInit, "body"> & {
  /** Sent as JSON (sets Content-Type). Use `body` instead for FormData (file uploads). */
  json?: unknown;
  body?: BodyInit | null;
  /** Default true: send the user to login when the session can't be refreshed. */
  redirectOnAuthFail?: boolean;
};

const LOCK_NAME = "yallaway-session-refresh";
let inTabRefresh: Promise<boolean> | null = null;

function send(path: string, init: ApiInit): Promise<Response> {
  const { json, redirectOnAuthFail: _ignored, ...rest } = init;
  void _ignored;
  const headers = new Headers(rest.headers);
  let body = rest.body;
  if (json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(json);
  }
  return fetch(path, { ...rest, headers, body, credentials: "include", cache: "no-store" });
}

/** Reads and drops the body of a reply we don't use: Chromium keeps an unread reply's request open. */
function discard(res: Response): void {
  void res.text().catch(() => {});
}

async function refreshSession(): Promise<boolean> {
  const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include", cache: "no-store" });
  discard(res);
  return res.ok;
}

/** Runs `task` with the refresh lock held, across tabs when the browser supports Web Locks. */
async function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && "locks" in navigator && navigator.locks) {
    return navigator.locks.request(LOCK_NAME, task);
  }
  return task();
}

/** After a 401: retry (someone may have refreshed meanwhile), else refresh once and retry. */
async function recover(path: string, init: ApiInit): Promise<Response> {
  return withRefreshLock(async () => {
    const again = await send(path, init);
    if (again.status !== 401) return again;
    inTabRefresh ??= refreshSession().finally(() => {
      inTabRefresh = null;
    });
    if (!(await inTabRefresh)) return again;
    discard(again);
    return send(path, init);
  });
}

/** Sends with the 401 handling above; null when the page is leaving for login. */
async function request(path: string, init: ApiInit): Promise<Response | null> {
  let res = await send(path, init);
  const isAuthCall = path.startsWith("/api/auth/login") || path.startsWith("/api/auth/refresh");
  if (res.status === 401 && !isAuthCall) {
    discard(res);
    res = await recover(path, init);
  }

  if (res.status === 401 && !isAuthCall && init.redirectOnAuthFail !== false) {
    window.location.assign(loginPath(window.location.pathname + window.location.search));
    return null;
  }
  return res;
}

async function toApiError(res: Response): Promise<ApiError> {
  const text = await res.text();
  const data: unknown = text ? safeJson(text) : undefined;
  return new ApiError(res.status, isApiError(data) ? data : null);
}

export async function apiFetch<T = unknown>(path: string, init: ApiInit = {}): Promise<T> {
  const res = await request(path, init);
  if (!res) return new Promise<T>(() => {}); // the page is leaving; never settle
  if (res.status === 204) return undefined as T;
  if (!res.ok) throw await toApiError(res);

  const text = await res.text();
  return (text ? safeJson(text) : undefined) as T;
}

/**
 * A file from the backend (e.g. the itinerary PDF, ITN-28), with the same session and error
 * handling as apiFetch. `filename` is the one in the backend's Content-Disposition, else null.
 *
 *   const { blob, filename } = await apiBlob(`/api/itineraries/${id}/pdf`);
 */
export async function apiBlob(path: string, init: ApiInit = {}): Promise<{ blob: Blob; filename: string | null }> {
  const res = await request(path, init);
  if (!res) return new Promise(() => {}); // the page is leaving; never settle
  if (!res.ok) throw await toApiError(res);
  const disposition = res.headers.get("content-disposition") ?? "";
  return { blob: await res.blob(), filename: /filename="([^"]+)"/.exec(disposition)?.[1] ?? null };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
