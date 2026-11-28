// - (Bonus) Reviews: /hotel/reviews
// Part: T6 Hotel dashboard
// Requirements: HTL-26, HTL-24
// Endpoints: GET /api/hotels/{id}/reviews; POST /api/reviews/{id}/reply
// Rendering: Dynamic SSR + Client Components. Source: .md section 9 "Admin / Moderator Dashboards"; Client Components for the interactive form, as section 9 says "where browser-side interactivity is required".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page - (Bonus)). Use a shell and kit components (frontend/README.md).
// Built (27 Nov): the hotel's reviews, newest first (10 per page, ?page=N, GEN-05) with the average rating, each in the
// shared ReviewCard; reviews without a reply get a Reply box (Client Component ReviewReplyForm, HTL-26). Hidden reviews
// (GEN-10) are marked and cannot be answered. Loading skeleton, empty state (GEN-04).
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PaginationBar } from "@/components/app/pagination-bar";
import { ReviewReplyForm } from "@/components/app/hotel-dashboard/review-reply-form";
import { ReviewCard, type HotelReview } from "@/components/app/shared/review-card";
import { StarRating } from "@/components/app/shared/star-rating";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Reviews", robots: { index: false } };

type ReviewItem = HotelReview & { hidden: boolean };
type ReviewsPage = {
  items: ReviewItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  averageRating: number;
  ratingCount: number;
};

async function ReviewsData({ hotelId, page }: { hotelId: string; page: number }) {
  const data = await backendJson<ReviewsPage>(`/api/hotels/${encodeURIComponent(hotelId)}/reviews?page=${page}`);
  if (!data) throw new Error("Could not load the reviews of your hotel");

  if (data.total === 0) {
    return (
      <EmptyState
        title="No reviews yet"
        line="So quiet! Reviews will show up here."
        description="Guests can review your hotel after their stay. You can reply to each review here."
      />
    );
  }

  if (data.items.length === 0) {
    return (
      <EmptyState
        title="That page doesn't exist"
        description="There are no reviews on this page."
        action={
          <Button asChild variant="secondary">
            <Link href="/hotel/reviews">Go to the first page</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <StarRating value={data.averageRating} />
        <span className="text-sm text-muted-foreground">
          {data.ratingCount} {data.ratingCount === 1 ? "rating" : "ratings"}
        </span>
      </div>
      <ul className="grid gap-4">
        {data.items.map((review) => (
          <li key={review.id}>
            <ReviewCard
              review={review}
              hidden={review.hidden}
              actions={!review.reply && !review.hidden ? <ReviewReplyForm reviewId={review.id} /> : undefined}
            />
          </li>
        ))}
      </ul>
      <PaginationBar
        page={data.page}
        totalPages={data.totalPages}
        total={data.total}
        pageSize={data.pageSize}
        hrefFor={(p) => `/hotel/reviews?page=${p}`}
      />
    </div>
  );
}

function ReviewsSkeleton() {
  return (
    <div className="grid gap-4" role="status" aria-label="Loading reviews">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const user = await requireUser(["hotel_moderator"]);
  if (!user.hotelId) throw new Error("This moderator account has no hotel");
  const raw = Number((await searchParams).page);
  const page = Number.isInteger(raw) && raw > 0 ? raw : 1;
  const unread = await getUnreadCount();

  return (
    <DashboardShell user={user} unreadNotifications={unread}>
      <PageHeader title="Reviews" description="What guests say about your hotel. Reply to a review to answer them publicly." />
      <Suspense key={page} fallback={<ReviewsSkeleton />}>
        <ReviewsData hotelId={user.hotelId} page={page} />
      </Suspense>
    </DashboardShell>
  );
}
