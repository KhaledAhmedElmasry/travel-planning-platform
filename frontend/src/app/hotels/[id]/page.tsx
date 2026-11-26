// P-18 Hotel details: /hotels/[id]
// Part: T2 Hotels + my posts list
// Requirements: HTL-02, HTL-15, HTL-24, GEN-09
// Endpoints: GET /api/hotels/{id}; GET /api/hotels/{id}/rooms/available; GET /api/hotels/{id}/reviews
// Rendering: Dynamic SSR. Not in .md section 9, decided by the team leader (23 Nov): public, but the free rooms depend on the dates in the URL and change with every hold, so the data must be fresh on every request; add SEO metadata (public page).
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-18). Use a shell and kit components (frontend/README.md).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PaginationBar } from "@/components/app/pagination-bar";
import { ReportButton } from "@/components/app/report-button";
import { ReviewCard, type HotelReview } from "@/components/app/shared/review-card";
import { StarRating } from "@/components/app/shared/star-rating";
import { Button } from "@/components/ui/button";
import { PublicShell } from "@/components/layout/public-shell";
import { backendJson } from "@/lib/server/backend";
import { HotelGallery } from "@/components/app/hotels/hotel-gallery";
import { RoomSelectionList, type AvailableRoom } from "@/components/app/hotels/room-selection-list";
import Link from "next/link";

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

type Reviews = {
  items: HotelReview[];
  averageRating: number;
  ratingCount: number;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type SearchParams = { checkIn?: string; checkOut?: string; guests?: string; page?: string };

function queryValue(value: string | undefined) {
  return value && /^[\w-]+$/.test(value) ? value : undefined;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const hotel = await backendJson<Pick<HotelDetails, "name" | "description">>(`/api/hotels/${encodeURIComponent(id)}`);
  return hotel ? { title: hotel.name, description: hotel.description } : { title: "Hotel details" };
}

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const checkIn = queryValue(search.checkIn);
  const checkOut = queryValue(search.checkOut);
  const guests = queryValue(search.guests);
  const reviewPage = Number(search.page) > 0 ? Math.floor(Number(search.page)) : 1;
  const query = new URLSearchParams();
  if (checkIn) query.set("checkIn", checkIn);
  if (checkOut) query.set("checkOut", checkOut);
  if (guests) query.set("guests", guests);

  const hotel = await backendJson<HotelDetails>(`/api/hotels/${encodeURIComponent(id)}${query.toString() ? `?${query}` : ""}`);
  if (!hotel) notFound();

  const roomQuery = new URLSearchParams(query);
  roomQuery.set("page", "1");
  const [rooms, reviews] = await Promise.all([
    checkIn && checkOut
      ? backendJson<{ items: AvailableRoom[]; page: number; pageSize: number; total: number; totalPages: number }>(
          `/api/hotels/${encodeURIComponent(id)}/rooms/available?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}&page=1`,
        )
      : Promise.resolve(null),
    backendJson<Reviews>(`/api/hotels/${encodeURIComponent(id)}/reviews?page=${reviewPage}`),
  ]);
  const reviewData = reviews ?? { items: [], averageRating: hotel.averageRating, ratingCount: hotel.ratingCount, page: 1, pageSize: 10, total: 0, totalPages: 1 };

  return (
    <PublicShell>
      <PageHeader title={hotel.name} description={hotel.address} back={{ href: "/hotels", label: "Hotel search" }} />
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
          {rooms ? <RoomSelectionList hotelId={id} rooms={rooms.items} query={roomQuery.toString()} /> : (
            <div className="grid gap-3 rounded-xl border border-border bg-muted p-6">
              <p className="text-muted-foreground">Search with check-in and check-out dates to view rooms.</p>
              <Button asChild className="w-fit"><Link href="/hotels">Search hotels</Link></Button>
            </div>
          )}
        </section>

        <section className="grid gap-4" aria-labelledby="hotel-reviews">
          <PageHeader title={<span id="hotel-reviews">Reviews</span>} description={`${reviewData.averageRating.toFixed(1)} average from ${reviewData.ratingCount} ratings.`} />
          {reviewData.items.length === 0 ? <EmptyState title="No reviews yet" line="Be the first to share your stay." pose="sit" /> : (
            <>
              <div className="grid gap-4">
                {reviewData.items.map((review) => <ReviewCard key={review.id} review={review} actions={<ReportButton contentType="review" contentId={review.id} />} />)}
              </div>
              <PaginationBar page={reviewData.page} totalPages={reviewData.totalPages} total={reviewData.total} pageSize={reviewData.pageSize} hrefFor={(page) => `/hotels/${encodeURIComponent(id)}?${new URLSearchParams([...query, ["page", String(page)]])}`} />
            </>
          )}
        </section>
      </div>
    </PublicShell>
  );
}
