// P-28 Public itinerary: /itineraries/[id]
// Part: Lead (foundation)
// Requirements: ITN-21, GEN-09, BON-02 (Bonus)
// Endpoints: GET /api/itineraries/public/{id}; POST /api/itineraries/{id}/clone; GET /api/countries; GET /api/cities; GET /api/auth/me; GET, POST /api/favourites; DELETE /api/favourites/{id}; POST /api/reports
// Rendering: ISR / Static. Source: .md section 9 "Public Itinerary Detail"; add SEO metadata (public page).
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-28). Use a shell and kit components (frontend/README.md).
// Built (24 Nov): author, days, activities, budget as entered (PublicItineraryView); Clone, Save, Report are a
// Client Component (ItineraryActions) that finds out who is viewing in the browser. The backend is called
// WITHOUT cookies and cached with the tag itinerary:<id>, which the backend refreshes when the itinerary is
// edited, hidden, made private or deleted, or its author changes (B5); 404 for private/hidden/unknown ones.
// Full country and city names (team leader answer 24 Nov) from the public lists, also fetched WITHOUT cookies.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { City, Country } from "@/components/app/search/hotel-search-form";
import { PublicShell } from "@/components/layout/public-shell";
import { allPages } from "@/lib/all-pages";
import { ISR_REVALIDATE_SECONDS, itineraryTag } from "@/lib/cache-tags";
import { BACKEND_URL } from "@/lib/server/backend";
import { ItineraryActions } from "./itinerary-actions";
import { PublicItineraryView, type PublicItinerary } from "./public-itinerary";

export const revalidate = 60; // = ISR_REVALIDATE_SECONDS (Next.js needs a literal here)

// No itinerary is built ahead; each one is rendered on its first visit and then cached (Next.js 16 ISR).
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string }> };
type Page<T> = { items: T[]; totalPages: number };

/** A public reference list page, cached for ISR; null on error (names then fall back to codes / ids). */
async function publicPage<T>(path: string): Promise<Page<T> | null> {
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, { next: { revalidate: ISR_REVALIDATE_SECONDS } });
    return res.ok ? ((await res.json()) as Page<T>) : null;
  } catch {
    return null;
  }
}
const publicList = <T,>(path: string) => allPages((page) => publicPage<T>(`${path}?page=${page}`));

/** The public itinerary, or null (404). Shared by the page and its metadata (one request, React cache). */
const loadItinerary = cache(async (id: string): Promise<PublicItinerary | null> => {
  const res = await fetch(`${BACKEND_URL}/api/itineraries/public/${encodeURIComponent(id)}`, {
    next: { revalidate: ISR_REVALIDATE_SECONDS, tags: [itineraryTag(id)] },
  });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`Could not load the itinerary (${res.status})`);
  return (await res.json()) as PublicItinerary;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const it = await loadItinerary(id);
  if (!it) return { title: "Itinerary not found", robots: { index: false } };
  const days = it.days.length === 1 ? "1 day" : `${it.days.length} days`;
  const description = `${it.title}: a ${days} itinerary by ${it.author.name}, with activities and budget.`;
  return {
    title: it.title,
    description,
    alternates: { canonical: `/itineraries/${it.id}` },
    openGraph: { type: "article", siteName: "Yallaway", title: it.title, description },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const [it, countries, cities] = await Promise.all([
    loadItinerary(id),
    publicList<Country>("/api/countries"),
    publicList<City>("/api/cities"),
  ]);
  if (!it) notFound();

  return (
    <PublicShell>
      <PublicItineraryView
        itinerary={it}
        actions={<ItineraryActions itineraryId={it.id} />}
        countryNames={Object.fromEntries(countries.map((c) => [c.code, c.name]))}
        cityNames={Object.fromEntries(cities.map((c) => [c.cityId, c.name]))}
      />
    </PublicShell>
  );
}
