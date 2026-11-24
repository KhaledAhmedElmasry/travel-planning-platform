// Home page (guest landing): /
// Part: Lead (foundation)
// Requirements: ACC-04 (role home), GEN-12
// Endpoints: GET /api/airports; GET /api/countries; GET /api/cities; GET /api/attractions; GET /api/itineraries/public/search
// Rendering: ISR / Static. Not in .md section 9, decided by the team leader (23 Nov): same page for every visitor, fast and good for SEO; featured itineraries may be a few minutes old. Add SEO metadata.
// Content (spec section 2, Guest row; team leader 24 Nov): hero with So3ad + flight/hotel search box,
// featured public itineraries (the newest, 6), popular destinations (the seeded cities with their attraction).
// The backend is called WITHOUT cookies and cached for ISR_REVALIDATE_SECONDS, so one page serves
// every visitor; the header finds out in the browser whether someone is logged in (PublicShell).
import type { Metadata } from "next";
import { So3ad } from "@/components/app/so3ad";
import type { Airport } from "@/components/app/search/flight-search-form";
import type { City, Country } from "@/components/app/search/hotel-search-form";
import { PublicShell } from "@/components/layout/public-shell";
import { allPages } from "@/lib/all-pages";
import { ISR_REVALIDATE_SECONDS } from "@/lib/cache-tags";
import { BACKEND_URL } from "@/lib/server/backend";
import { HomeSearch } from "./home-search";
import {
  FeaturedItineraries,
  PopularDestinations,
  type Attraction,
  type ItinerarySummary,
} from "./popular-destinations";

export const revalidate = 60; // = ISR_REVALIDATE_SECONDS (Next.js needs a literal here)

const DESCRIPTION =
  "Search flights and hotels, plan your days, keep your budget in your own currency and share your trip with other travelers.";

export const metadata: Metadata = {
  title: { absolute: "Yallaway · Flights, hotels and itineraries" },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Yallaway", title: "Yallaway", description: DESCRIPTION },
};

type Page<T> = { items: T[]; totalPages: number };

/** A public list, cached for ISR. If the backend is down (e.g. during `next build`) the section is empty until the next refresh. */
async function publicPage<T>(path: string): Promise<Page<T> | null> {
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, { next: { revalidate: ISR_REVALIDATE_SECONDS } });
    return res.ok ? ((await res.json()) as Page<T>) : null;
  } catch {
    return null;
  }
}
const publicList = <T,>(path: string) => allPages((page) => publicPage<T>(`${path}?page=${page}`));

export default async function HomePage() {
  const [airports, countries, cities, attractions, featured] = await Promise.all([
    publicList<Airport>("/api/airports"),
    publicList<Country>("/api/countries"),
    publicList<City>("/api/cities"),
    publicList<Attraction>("/api/attractions"),
    // TODO(ask team leader): the public search is sorted by last update (updatedAt), and has no
    // "newest first" option; this shows the first 6 of that order. Add a sort to the backend?
    publicPage<ItinerarySummary>("/api/itineraries/public/search"),
  ]);

  return (
    <PublicShell>
      <div className="grid gap-12">
        <section className="flex flex-col-reverse items-center gap-10 md:flex-row md:justify-between">
          <div className="grid max-w-xl gap-4">
            <p className="text-sm font-semibold tracking-widest text-cyan uppercase">Flights · Hotels · Itineraries</p>
            <h1 className="text-[clamp(2.25rem,6vw,3rem)] leading-tight font-bold tracking-tight">
              Yalla! Where are we going?
            </h1>
            <p className="text-muted-foreground">{DESCRIPTION}</p>
          </div>
          <So3ad pose="wave" size={260} />
        </section>
        <HomeSearch airports={airports} countries={countries} cities={cities} />
        <FeaturedItineraries itineraries={featured?.items ?? []} />
        <PopularDestinations cities={cities} countries={countries} attractions={attractions} />
      </div>
    </PublicShell>
  );
}
