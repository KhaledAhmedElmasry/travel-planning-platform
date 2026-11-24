// HotelResultCard
// Part: Lead (foundation)
// Requirements: HTL-11
// Used by: P-15, P-26
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
//
// <HotelResultCard hotel={item} cityName="Cairo" countryName="Egypt" search={{ checkIn, checkOut, guests, rooms }} />
// One hotel of GET /api/hotels/search (spec P-15): photo, name, stars, city and country, price per
// night of the cheapest qualifying room (HTL-12) and the average rating. Team leader (23 Nov): the
// page passes the place names (from GET /api/cities and /api/countries), and the whole card links
// to /hotels/{id} with the searched dates, guests and rooms, so P-18 lists the free rooms.
import Link from "next/link";
import { BedDoubleIcon, StarIcon } from "lucide-react";
import { Price } from "@/components/app/price";
import type { HotelSearchParams } from "./hotel-search-form";

/** One hotel of GET /api/hotels/search (openapi HotelSearchResult). */
export type HotelSearchResult = {
  id: string;
  name: string;
  cityId: string;
  countryCode: string;
  starRating: number;
  photo: string | null;
  averageRating: number;
  ratingCount: number;
  pricePerNight: number;
  currency: string;
  freeRooms: number;
};

type Props = {
  hotel: HotelSearchResult;
  cityName: string;
  countryName: string;
  search: Pick<HotelSearchParams, "checkIn" | "checkOut" | "guests" | "rooms">;
};

export function HotelResultCard({ hotel, cityName, countryName, search }: Props) {
  const titleId = `hotel-${hotel.id}-title`;
  const query = new URLSearchParams({
    checkIn: search.checkIn,
    checkOut: search.checkOut,
    guests: String(search.guests),
    rooms: String(search.rooms),
  });
  return (
    <article
      aria-labelledby={titleId}
      className="relative grid overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-[12rem_minmax(0,1fr)]"
    >
      <div className="grid aspect-video place-items-center bg-muted sm:aspect-auto">
        {hotel.photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- uploads are served by the backend (same as the kit's ImageUploader)
          <img src={hotel.photo} alt={hotel.name} className="size-full object-cover" loading="lazy" />
        ) : (
          <BedDoubleIcon className="size-10 text-subtle-foreground" aria-hidden="true" />
        )}
      </div>
      <div className="grid gap-2 p-4 sm:p-6">
        <h3 id={titleId} className="text-lg font-semibold">
          {/* The link covers the whole card (after:absolute inset-0). */}
          <Link href={`/hotels/${hotel.id}?${query}`} className="after:absolute after:inset-0">
            {hotel.name}
          </Link>
        </h3>
        <span aria-label={`${hotel.starRating} stars`} className="flex gap-0.5 text-accent-cyan">
          {Array.from({ length: hotel.starRating }, (_, i) => (
            <StarIcon key={i} className="size-4 fill-current" aria-hidden="true" />
          ))}
        </span>
        <span className="text-muted-foreground">
          {cityName}, {countryName}
        </span>
        <span className="text-sm">
          {hotel.ratingCount > 0 ? (
            <>
              <strong>{hotel.averageRating.toFixed(1)}</strong> / 5 · {hotel.ratingCount} rating
              {hotel.ratingCount === 1 ? "" : "s"}
            </>
          ) : (
            "No ratings yet"
          )}
        </span>
        <div className="flex items-baseline gap-1 justify-self-end">
          <Price cents={hotel.pricePerNight} currency={hotel.currency} size="lg" />
          <span className="text-sm text-muted-foreground">per night</span>
        </div>
      </div>
    </article>
  );
}
