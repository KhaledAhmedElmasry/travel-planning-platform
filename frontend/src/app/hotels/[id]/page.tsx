// P-18 Hotel details: /hotels/[id]
// Part: T2 Hotels + my posts list
// Requirements: HTL-02, HTL-15, HTL-24, GEN-09
// Endpoints: GET /api/hotels/{id}; GET /api/hotels/{id}/rooms/available; GET /api/hotels/{id}/reviews
// Rendering: Dynamic SSR. Not in .md section 9, decided by the team leader (23 Nov): public, but the free rooms depend on the dates in the URL and change with every hold, so the data must be fresh on every request; add SEO metadata (public page).
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-18). Use a shell and kit components (frontend/README.md).
// Built: profile with city and country names (GEN-12), photos, amenities, check-in/out times, cancellation policy,
// rating; with dates, ALL free rooms (HTL-15) 10 per page with multi-select and "Book selected rooms" (P-19 via
// ?roomIds=); reviews newest first, paginated, Report (GEN-09), admin hide/unhide/delete (GEN-10), Favourite (BON-02).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { ErrorState } from "@/components/app/error-state";
import { PageHeader } from "@/components/app/page-header";
import { PaginationBar } from "@/components/app/pagination-bar";
import { ReportButton } from "@/components/app/report-button";
import { FavouriteButton } from "@/components/app/shared/favourite-button";
import { ReviewCard, type HotelReview } from "@/components/app/shared/review-card";
import { StarRating } from "@/components/app/shared/star-rating";
import { Button } from "@/components/ui/button";
import { PublicShell } from "@/components/layout/public-shell";
import { allPages } from "@/lib/all-pages";
import { backendFetch, backendJson } from "@/lib/server/backend";
import { getSessionUser, getUnreadCount } from "@/lib/server/session";
import { HotelGallery } from "@/components/app/hotels/hotel-gallery";
import { RoomSelectionList, type AvailableRoom } from "@/components/app/hotels/room-selection-list";
import { BackLink } from "./back-link";
import { ReviewAdminActions } from "./review-admin-actions";

type HotelDetails = {
  id: string;
  name: string;
  address: string;
  cityId: string;
  countryCode: string;
  description: string;
  starRating: number;
  photos: { id: string; url: string }[];
  amenities: string[];
  checkInTime: string;
  checkOutTime: string;
  cancellationTiers: { daysBefore: number; refundPercentage: number }[];
  averageRating: number;
  ratingCount: number;
};

/** GET /api/hotels/{id}/reviews item: `hidden` is true for a review an admin hid (GEN-10). */
type ListedReview = HotelReview & { hidden: boolean };
type Reviews = { items: ListedReview[]; averageRating: number; ratingCount: number; page: number; pageSize: number; total: number; totalPages: number };
type Paginated<T> = { items: T[]; totalPages: number };
type SearchParams = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const asDate = (value: string | undefined) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const hotel = await backendJson<Pick<HotelDetails, "name" | "description">>(`/api/hotels/${encodeURIComponent(id)}`);
  return hotel ? { title: hotel.name, description: hotel.description } : { title: "Hotel details" };
}

/** Every free room for the dates (all pages, HTL-15), or the backend's 400 message (e.g. check-out not after check-in). */
async function freeRooms(id: string, checkIn: string, checkOut: string): Promise<{ rooms: AvailableRoom[] } | { error: string }> {
  const path = (page: number) => `/api/hotels/${encodeURIComponent(id)}/rooms/available?${new URLSearchParams({ checkIn, checkOut, page: String(page) })}`;
  const first = await backendFetch(path(1));
  if (first.status === 400) {
    const body = (await first.json().catch(() => ({}))) as { message?: string };
    return { error: body.message ?? "These dates are not valid." };
  }
  if (!first.ok) throw new Error(`GET rooms/available failed with ${first.status}`);
  const page1 = (await first.json()) as Paginated<AvailableRoom>;
  return { rooms: await allPages((page) => (page === 1 ? Promise.resolve(page1) : backendJson<Paginated<AvailableRoom>>(path(page)))) };
}

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const checkIn = asDate(one(search.checkIn));
  const checkOut = asDate(one(search.checkOut));
  const reviewPage = Number(one(search.page)) > 0 ? Math.floor(Number(one(search.page))) : 1;

  const [hotel, user] = await Promise.all([backendJson<HotelDetails>(`/api/hotels/${encodeURIComponent(id)}`), getSessionUser()]);
  if (!hotel) notFound();

  const [found, reviews, countries, cities, favourites, unread] = await Promise.all([
    checkIn && checkOut ? freeRooms(id, checkIn, checkOut) : Promise.resolve(null),
    backendJson<Reviews>(`/api/hotels/${encodeURIComponent(id)}/reviews?page=${reviewPage}`),
    allPages((p) => backendJson<Paginated<{ code: string; name: string }>>(`/api/countries?page=${p}`)),
    allPages((p) => backendJson<Paginated<{ cityId: string; name: string }>>(`/api/cities?page=${p}`)),
    user?.role === "user" ? backendJson<Paginated<{ id: string }>>(`/api/favourites?type=hotel&targetId=${encodeURIComponent(id)}`) : Promise.resolve(null),
    user ? getUnreadCount() : Promise.resolve(0),
  ]);
  const reviewData = reviews ?? { items: [], averageRating: hotel.averageRating, ratingCount: hotel.ratingCount, page: 1, pageSize: 10, total: 0, totalPages: 1 };
  const city = cities.find((c) => c.cityId === hotel.cityId)?.name ?? hotel.cityId;
  const country = countries.find((c) => c.code === hotel.countryCode)?.name ?? hotel.countryCode;
  // Review pages keep the dates and the rooms page.
  const reviewHref = (page: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(search)) if (key !== "page" && typeof value === "string") query.set(key, value);
    query.set("page", String(page));
    return `/hotels/${encodeURIComponent(id)}?${query}`;
  };

  return (
    <PublicShell user={user} unreadNotifications={unread}>
      <BackLink />
      <PageHeader
        title={hotel.name}
        description={`${hotel.address} · ${city}, ${country}`}
        actions={<FavouriteButton type="hotel" targetId={hotel.id} favouriteId={favourites?.items[0]?.id ?? null} role={user?.role ?? null} />}
      />
      <div className="grid gap-10">
        <HotelGallery hotelName={hotel.name} photos={hotel.photos} />
        <section className="grid gap-4" aria-labelledby="hotel-overview">
          <h2 id="hotel-overview" className="text-2xl font-bold">About this hotel</h2>
          <p className="max-w-prose whitespace-pre-line text-muted-foreground">{hotel.description}</p>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-2" aria-label={`${hotel.averageRating} out of 5 stars`}>
              <StarRating value={hotel.averageRating} />
              <strong>{hotel.averageRating.toFixed(1)}</strong>
              <span className="text-muted-foreground">({hotel.ratingCount} ratings)</span>
            </span>
            <span className="text-muted-foreground">{hotel.starRating}-star hotel</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <p><strong>Check-in:</strong> {hotel.checkInTime}</p>
            <p><strong>Check-out:</strong> {hotel.checkOutTime}</p>
          </div>
          {hotel.amenities.length > 0 && (
            <div className="grid gap-2">
              <h3 className="font-semibold">Amenities</h3>
              <ul className="flex flex-wrap gap-2" aria-label="Amenities">
                {hotel.amenities.map((amenity) => <li key={amenity} className="rounded-full border border-border px-3 py-1 text-sm">{amenity}</li>)}
              </ul>
            </div>
          )}
          {hotel.cancellationTiers.length > 0 && (
            <div className="grid gap-2">
              <h3 className="font-semibold">Cancellation policy</h3>
              <ul className="grid gap-1 text-muted-foreground">
                {hotel.cancellationTiers.map((tier) => <li key={tier.daysBefore}>{tier.daysBefore} days before check-in: {tier.refundPercentage}% refund</li>)}
              </ul>
            </div>
          )}
        </section>

        <section className="grid gap-4" aria-labelledby="available-rooms">
          <PageHeader title={<span id="available-rooms">Available rooms</span>} description={checkIn && checkOut ? `Rooms for ${checkIn} to ${checkOut}.` : "Choose dates in hotel search to see available rooms."} />
          {found && "rooms" in found && checkIn && checkOut ? (
            <RoomSelectionList hotelId={id} rooms={found.rooms} checkIn={checkIn} checkOut={checkOut} />
          ) : found && "error" in found ? (
            <ErrorState title="We couldn't load the rooms for these dates" message={found.error} />
          ) : (
            <div className="grid gap-3 rounded-xl border border-border bg-muted p-6">
              <p className="text-muted-foreground">Search with check-in and check-out dates to view rooms.</p>
              <Button asChild className="w-fit"><Link href="/hotels">Search hotels</Link></Button>
            </div>
          )}
        </section>

        <section className="grid gap-4" aria-labelledby="hotel-reviews">
          <PageHeader title={<span id="hotel-reviews">Reviews</span>} description={`${reviewData.averageRating.toFixed(1)} average from ${reviewData.ratingCount} ratings.`} />
          {reviewData.items.length === 0 ? <EmptyState title="No reviews yet" pose="sit" /> : (
            <>
              <div className="grid gap-4">
                {reviewData.items.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    hidden={review.hidden}
                    actions={
                      <>
                        <ReportButton contentType="review" contentId={review.id} />
                        {user?.role === "admin" && <ReviewAdminActions id={review.id} hidden={review.hidden} />}
                      </>
                    }
                  />
                ))}
              </div>
              <PaginationBar page={reviewData.page} totalPages={reviewData.totalPages} total={reviewData.total} pageSize={reviewData.pageSize} hrefFor={reviewHref} />
            </>
          )}
        </section>
      </div>
    </PublicShell>
  );
}
