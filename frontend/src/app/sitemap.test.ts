// /sitemap.xml (.md section 9 SEO): the public pages, plus every public itinerary (P-28, ISR).
import { afterEach, expect, test, vi } from "vitest";
import sitemap from "./sitemap";

afterEach(() => {
  vi.unstubAllGlobals();
});

const STATIC = ["/", "/flights", "/hotels", "/itineraries", "/blog", "/login", "/signup", "/terms"].map(
  (path) => `http://localhost:3001${path === "/" ? "" : path}`,
);

function backend(pages: Record<number, { items: { id: string }[]; totalPages: number }>) {
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) => {
    const page = Number(new URL(url).searchParams.get("page"));
    const body = pages[page];
    return body ? new Response(JSON.stringify(body)) : new Response("", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// source: team leader (24 Nov, Q2: static public routes; Q9: /kit is not in the sitemap)
test("lists the static public pages with absolute URLs, and not the private, noindex or kit pages", async () => {
  backend({ 1: { items: [], totalPages: 0 } });
  const urls = (await sitemap()).map((e) => e.url);
  expect(urls).toEqual(STATIC);
  for (const hidden of ["/kit", "/home", "/account", "/forgot-password", "/reset-password", "/verify-email"]) {
    expect(urls).not.toContain(`http://localhost:3001${hidden}`);
  }
});

// source: team leader (24 Nov, Q2: ISR detail pages where the ids can be listed) + .md section 9 "Public Itinerary Detail"
test("adds every public itinerary from all pages of GET /api/itineraries/public/search", async () => {
  const fetchMock = backend({
    1: { items: [{ id: "a1" }, { id: "a2" }], totalPages: 2 },
    2: { items: [{ id: "b1" }], totalPages: 2 },
  });
  const urls = (await sitemap()).map((e) => e.url);
  expect(urls).toEqual([
    ...STATIC,
    "http://localhost:3001/itineraries/a1",
    "http://localhost:3001/itineraries/a2",
    "http://localhost:3001/itineraries/b1",
  ]);
  expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/itineraries\/public\/search\?page=1$/);
  // Public data only: no cookies, cached like the ISR pages.
  expect(fetchMock.mock.calls[0][1]).toEqual({ next: { revalidate: 60 } });
});

// source: frontend/src/app/page.tsx (the backend may be down during next build: the page still builds)
test("still returns the static pages when the backend is not reachable", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("ECONNREFUSED"))));
  expect((await sitemap()).map((e) => e.url)).toEqual(STATIC);
});
