// P-42 My hotel: /hotel/profile
// Part: T6 Hotel dashboard
// Requirements: HTL-01, GEN-08, GEN-12
// Endpoints: GET, PATCH /api/hotels/{id}; GET /api/countries
// Rendering: Dynamic SSR + Client Components. Source: .md section 9 "Admin / Moderator Dashboards"; Client Components for the interactive form, as section 9 says "where browser-side interactivity is required".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-42). Use a shell and kit components (frontend/README.md).
// Built (27 Nov): the server page reads the hotel (GET /api/hotels/{id}), all countries and the cities of the hotel's
// country (GET /api/cities?country=, spec section 8); the Client Component HotelProfileForm saves one multipart PATCH
// (fields, amenities, new photos, removed photos). After a save the page data changes, so the form is re-created
// from it (key). Loading skeleton; errors under the fields.
import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import {
  HotelProfileForm,
  type City,
  type Country,
  type HotelProfile,
} from "@/components/app/hotel-dashboard/hotel-profile-form";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { allPages } from "@/lib/all-pages";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "My hotel", robots: { index: false } };

async function ProfileData({ hotelId }: { hotelId: string }) {
  const hotel = await backendJson<HotelProfile>(`/api/hotels/${encodeURIComponent(hotelId)}`);
  if (!hotel) throw new Error("Could not load your hotel");
  const [countries, cities] = await Promise.all([
    allPages((page) => backendJson<{ items: Country[]; totalPages: number }>(`/api/countries?page=${page}`)),
    allPages((page) =>
      backendJson<{ items: City[]; totalPages: number }>(
        `/api/cities?country=${encodeURIComponent(hotel.countryCode)}&page=${page}`,
      ),
    ),
  ]);
  return <HotelProfileForm key={JSON.stringify(hotel)} hotel={hotel} countries={countries} initialCities={cities} />;
}

function ProfileSkeleton() {
  return (
    <div className="grid max-w-2xl gap-6" role="status" aria-label="Loading your hotel">
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export default async function Page() {
  const user = await requireUser(["hotel_moderator"]);
  if (!user.hotelId) throw new Error("This moderator account has no hotel");
  const unread = await getUnreadCount();

  return (
    <DashboardShell user={user} unreadNotifications={unread}>
      <PageHeader title="My hotel" description="What guests see on your hotel page: details, star class, amenities and photos." />
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileData hotelId={user.hotelId} />
      </Suspense>
    </DashboardShell>
  );
}
