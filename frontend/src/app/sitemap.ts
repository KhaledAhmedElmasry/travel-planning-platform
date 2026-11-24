// /sitemap.xml (.md section 9 SEO): the public pages search engines should find, with absolute URLs.
// Static public pages, plus every public itinerary (P-28, ISR). Not listed: private pages and the
// noindex pages (forgot/reset password, verify email, /kit). Blog posts (P-30) and author pages (P-32)
// are added when those pages are built.
import type { MetadataRoute } from "next";
import { allPages } from "@/lib/all-pages";
import { ISR_REVALIDATE_SECONDS } from "@/lib/cache-tags";
import { BACKEND_URL } from "@/lib/server/backend";
import { absoluteUrl } from "@/lib/site-url";

export const revalidate = 60; // = ISR_REVALIDATE_SECONDS (Next.js needs a literal here)

const STATIC_PUBLIC_ROUTES = ["/", "/flights", "/hotels", "/itineraries", "/blog", "/login", "/signup", "/terms"];

type Page<T> = { items: T[]; totalPages: number };

/** One page of public itineraries, without cookies (public data), or null when the backend can't answer. */
async function publicItineraries(page: number): Promise<Page<{ id: string }> | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/itineraries/public/search?page=${page}`, {
      next: { revalidate: ISR_REVALIDATE_SECONDS },
    });
    return res.ok ? ((await res.json()) as Page<{ id: string }>) : null;
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // shortcut: reads every page of the search (10 per page); fine for the project's data size.
  const itineraries = await allPages(publicItineraries);
  return [
    ...STATIC_PUBLIC_ROUTES.map((path) => ({ url: absoluteUrl(path) })),
    ...itineraries.map((it) => ({ url: absoluteUrl(`/itineraries/${it.id}`) })),
  ];
}
