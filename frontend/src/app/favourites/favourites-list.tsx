"use client";

// Favourites (BON-02 bonus): Hotels | Itineraries tabs, 10 per page, Remove asks first (GEN-03) then
// DELETE /api/favourites/{id}. The server page loads only the chosen tab (?tab=, ?page=).
// source: team leader decision 24 Nov - favourites
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPinIcon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState } from "@/components/app/empty-state";
import { PaginationBar } from "@/components/app/pagination-bar";
import { ItineraryCard, type ItinerarySummary } from "@/components/app/shared/itinerary-card";
import { StarRating } from "@/components/app/shared/star-rating";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, apiFetch } from "@/lib/api";

export type FavouriteTab = "hotels" | "itineraries";

/** backend favourites.service.ts FavouriteResponse */
type HotelSummary = {
  id: string;
  name: string;
  cityId: string;
  countryCode: string;
  starRating: number;
  photo: string | null;
  averageRating: number;
  ratingCount: number;
};
export type Favourite =
  | { id: string; type: "hotel"; targetId: string; item: HotelSummary }
  | { id: string; type: "itinerary"; targetId: string; item: ItinerarySummary };
export type FavouritePage = { items: Favourite[]; page: number; pageSize: number; total: number; totalPages: number };

/** code -> name from GET /api/countries and cityId -> name from GET /api/cities (full names, team leader 24 Nov). */
type Props = { tab: FavouriteTab; data: FavouritePage; countryNames: Record<string, string>; cityNames: Record<string, string> };

export function FavouritesSection(props: Props) {
  const router = useRouter();
  return <FavouritesView {...props} navigate={(path) => router.push(path)} refresh={() => router.refresh()} />;
}

export function FavouritesView({
  tab,
  data,
  countryNames,
  cityNames,
  navigate,
  refresh,
}: Props & { navigate: (path: string) => void; refresh: () => void }) {
  const [items, setItems] = useState(data.items);

  async function remove(favourite: Favourite) {
    try {
      await apiFetch(`/api/favourites/${favourite.id}`, { method: "DELETE" });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "We couldn't remove it. Try again.");
      throw error; // keeps the dialog open (ConfirmDialog)
    }
    setItems((list) => list.filter((f) => f.id !== favourite.id));
    toast.success("Removed from favourites");
    refresh(); // the counts and pages come from the server
  }

  const removeButton = (favourite: Favourite) => (
    <ConfirmDialog
      trigger={<Button variant="ghost" size="sm">Remove</Button>}
      title="Remove from favourites?"
      description={`${favourite.type === "hotel" ? favourite.item.name : favourite.item.title} will no longer be in your favourites.`}
      confirmLabel="Remove from favourites"
      onConfirm={() => remove(favourite)}
    />
  );

  // source: team leader answer 24 Nov - empty-state wording
  const empty = tab === "hotels" ? "No saved hotels yet" : "No saved itineraries yet";

  return (
    <Tabs value={tab} onValueChange={(value) => navigate(`/favourites?tab=${value}`)}>
      <TabsList>
        <TabsTrigger value="hotels">Hotels</TabsTrigger>
        <TabsTrigger value="itineraries">Itineraries</TabsTrigger>
      </TabsList>
      <TabsContent value={tab} className="grid gap-6 pt-4">
        {items.length === 0 ? (
          <EmptyState title={empty} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((favourite) =>
              favourite.type === "hotel" ? (
                <article key={favourite.id} className="grid gap-2 rounded-xl border border-border bg-card p-4">
                  <h3 className="text-base font-semibold">
                    <Link href={`/hotels/${favourite.item.id}`} className="hover:underline">
                      {favourite.item.name}
                    </Link>
                  </h3>
                  <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPinIcon className="size-4" aria-hidden="true" />
                    {cityNames[favourite.item.cityId] ?? favourite.item.cityId}, {countryNames[favourite.item.countryCode] ?? favourite.item.countryCode}
                  </p>
                  <StarRating value={favourite.item.starRating} />
                  <div>{removeButton(favourite)}</div>
                </article>
              ) : (
                <ItineraryCard
                  key={favourite.id}
                  itinerary={favourite.item}
                  countryNames={countryNames}
                  href={`/itineraries/${favourite.item.id}`}
                  actions={removeButton(favourite)}
                />
              ),
            )}
          </div>
        )}
        <PaginationBar
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          pageSize={data.pageSize}
          hrefFor={(p) => `/favourites?tab=${tab}&page=${p}`}
        />
      </TabsContent>
    </Tabs>
  );
}
