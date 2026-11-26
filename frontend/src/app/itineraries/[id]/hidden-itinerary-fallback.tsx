"use client";

// P-28 404 boundary, browser part (GEN-10: "Hidden content is visible only to its author and admins";
// team leader decision 26 Nov). P-28 is cached for everyone and read WITHOUT cookies, so a hidden
// itinerary is a 404 there. Here the browser asks GET /api/itineraries/public/{id} again WITH the
// session: the backend answers the author and admins, everyone else keeps the 404. The itinerary is
// public (else the backend would refuse the author too), so an answer here means it is hidden.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { City, Country } from "@/components/app/search/hotel-search-form";
import { NotFoundMessage } from "@/components/app/not-found-message";
import { Skeleton } from "@/components/ui/skeleton";
import { allPages } from "@/lib/all-pages";
import { apiFetch } from "@/lib/api";
import { ItineraryActions } from "./itinerary-actions";
import { PublicItineraryView, type PublicItinerary } from "./public-itinerary";

type Found = { itinerary: PublicItinerary; countryNames: Record<string, string>; cityNames: Record<string, string> };
type Page<T> = { items: T[]; totalPages: number };

const list = <T,>(path: string) =>
  allPages((page) => apiFetch<Page<T>>(`${path}?page=${page}`, { redirectOnAuthFail: false }).catch(() => null));

export function HiddenItineraryFallback({ itineraryId }: { itineraryId: string }) {
  const [found, setFound] = useState<Found | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: Found | null = null;
      try {
        const itinerary = await apiFetch<PublicItinerary>(`/api/itineraries/public/${encodeURIComponent(itineraryId)}`, {
          redirectOnAuthFail: false,
        });
        const [countries, cities] = await Promise.all([list<Country>("/api/countries"), list<City>("/api/cities")]);
        next = {
          itinerary,
          countryNames: Object.fromEntries(countries.map((c) => [c.code, c.name])),
          cityNames: Object.fromEntries(cities.map((c) => [c.cityId, c.name])),
        };
      } catch {
        // 404 (or 400 for a bad id): not visible to this viewer.
      }
      if (!cancelled) setFound(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [itineraryId]);

  if (found === undefined) {
    return (
      <div className="grid gap-4" aria-label="Loading">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (found === null) return <NotFoundMessage />;
  return (
    <div className="grid gap-4">
      <p role="status" className="rounded-lg border border-border bg-muted px-4 py-2 text-sm">
        This itinerary is hidden. Only its author and admins can see it.
      </p>
      <PublicItineraryView
        itinerary={found.itinerary}
        actions={<ItineraryActions itineraryId={found.itinerary.id} hidden />}
        countryNames={found.countryNames}
        cityNames={found.cityNames}
      />
    </div>
  );
}

/** The not-found file gets no params: the id is the last part of /itineraries/{id}. */
export function HiddenItineraryFromUrl() {
  const id = usePathname()?.split("/").pop() ?? "";
  return <HiddenItineraryFallback itineraryId={id} />;
}
