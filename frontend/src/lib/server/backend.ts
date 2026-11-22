// SERVER ONLY (Server Components, Route Handlers). Calls the backend directly, forwarding the
// visitor's cookies, so the backend sees the same session as the browser (ACC-19).
// In the browser use apiFetch() from "@/lib/api" instead.
//
//   const res = await backendFetch("/api/flight-bookings?group=upcoming");
//   if (!res.ok) ...                       // 401 = not logged in, see requireUser()
//   const data = (await res.json()) as Paginated<FlightBooking>;
//
// Never cached: every call is made for this visitor and this request (cache: "no-store").
// For public ISR pages (published post, author page, public itinerary) call fetch() yourself
// WITHOUT cookies and with { next: { revalidate } } so the page can be shared between visitors.
import { cookies } from "next/headers";

export const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const cookieHeader = (await cookies()).toString();
  const headers = new Headers(init.headers);
  if (cookieHeader) headers.set("cookie", cookieHeader);
  if (init.body && !headers.has("content-type") && typeof init.body === "string") {
    headers.set("content-type", "application/json");
  }
  const url = `${BACKEND_URL}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    return await fetch(url, { ...init, headers, cache: "no-store" });
  } catch (cause) {
    // The page shows the error page (src/app/error.tsx); the server log says what to fix.
    throw new Error(
      `The backend is not reachable at ${BACKEND_URL}. Start it (cd backend && npm run start:dev) or set BACKEND_URL in frontend/.env.local.`,
      { cause },
    );
  }
}

/** GET + JSON, or null when the backend answers 401/403/404 (the caller decides what to show). */
export async function backendJson<T>(path: string): Promise<T | null> {
  const res = await backendFetch(path);
  if (res.status === 401 || res.status === 403 || res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path} failed with ${res.status}`);
  return (await res.json()) as T;
}
