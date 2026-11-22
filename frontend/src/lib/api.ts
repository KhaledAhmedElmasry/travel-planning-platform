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

async function refreshSession(): Promise<boolean> {
  const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include", cache: "no-store" });
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
    const refreshed = await inTabRefresh;
    return refreshed ? send(path, init) : again;
  });
}

export async function apiFetch<T = unknown>(path: string, init: ApiInit = {}): Promise<T> {
  let res = await send(path, init);
  const isAuthCall = path.startsWith("/api/auth/login") || path.startsWith("/api/auth/refresh");
  if (res.status === 401 && !isAuthCall) res = await recover(path, init);

  if (res.status === 401 && !isAuthCall && init.redirectOnAuthFail !== false) {
    window.location.assign(loginPath(window.location.pathname + window.location.search));
    return new Promise<T>(() => {}); // the page is leaving; never settle
  }
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data: unknown = text ? safeJson(text) : undefined;
  if (!res.ok) throw new ApiError(res.status, isApiError(data) ? data : null);
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
