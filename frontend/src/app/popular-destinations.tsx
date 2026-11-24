// Public home sections (ACC-04, GEN-12; MILESTONE2 spec section 2, Guest row).
// PopularDestinations: one card per seeded city with its country and its attraction(s) (spec section 1:
// attractions are shown only here). FeaturedItineraries: the newest public itineraries, 6 of them
// (team leader decision 24 Nov).
import Link from "next/link";
import { LandmarkIcon, MapPinIcon } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { City, Country } from "@/components/app/search/hotel-search-form";

export type Attraction = { attractionId: string; name: string; cityId: string };
/** One item of GET /api/itineraries/public/search (openapi ItinerarySummaryList). */
export type ItinerarySummary = {
  id: string;
  title: string;
  countryCodes: string[];
  startDate: string;
  numberOfDays: number;
  visibility: "private" | "public";
};

export const FEATURED_ITINERARIES = 6;

export function PopularDestinations({
  cities,
  countries,
  attractions,
}: {
  cities: City[];
  countries: Country[];
  attractions: Attraction[];
}) {
  const countryName = new Map(countries.map((country) => [country.code, country.name]));
  return (
    <section aria-labelledby="destinations-heading" className="grid gap-4">
      <h2 id="destinations-heading" className="text-xl font-semibold">
        Popular destinations
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cities.map((city) => (
          <li key={city.cityId}>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>{city.name}</CardTitle>
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPinIcon className="size-4" aria-hidden="true" />
                  {countryName.get(city.countryCode) ?? city.countryCode}
                </p>
              </CardHeader>
              <CardContent className="grid gap-1 text-sm">
                {attractions
                  .filter((attraction) => attraction.cityId === city.cityId)
                  .map((attraction) => (
                    <p key={attraction.attractionId} className="flex items-center gap-1">
                      <LandmarkIcon className="size-4 text-cyan" aria-hidden="true" />
                      {attraction.name}
                    </p>
                  ))}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FeaturedItineraries({ itineraries }: { itineraries: ItinerarySummary[] }) {
  const shown = itineraries.slice(0, FEATURED_ITINERARIES);
  return (
    <section aria-labelledby="featured-heading" className="grid gap-4">
      <h2 id="featured-heading" className="text-xl font-semibold">
        Featured itineraries
      </h2>
      {shown.length === 0 ? (
        <EmptyState
          compact
          title="No public itineraries yet"
          action={
            <Button asChild variant="secondary">
              <Link href="/itineraries">Explore itineraries</Link>
            </Button>
          }
        />
      ) : (
        // TODO(L2): show each one with ItineraryCard (components/app/shared) after it merges.
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((itinerary) => (
            <li key={itinerary.id}>
              <Link href={`/itineraries/${itinerary.id}`} className="block rounded-xl border border-border bg-card p-4 hover:border-input">
                <span className="block font-semibold">{itinerary.title}</span>
                <span className="text-sm text-muted-foreground">
                  {itinerary.numberOfDays} {itinerary.numberOfDays === 1 ? "day" : "days"} · {itinerary.countryCodes.join(", ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
