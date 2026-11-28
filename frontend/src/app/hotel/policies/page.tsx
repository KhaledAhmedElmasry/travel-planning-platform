// P-46 Hotel policies: /hotel/policies
// Part: T6 Hotel dashboard
// Requirements: HTL-09, HTL-10
// Endpoints: PUT /api/hotels/{id}/policies
// Rendering: Dynamic SSR + Client Components. Source: .md section 9 "Admin / Moderator Dashboards"; Client Components for the interactive form, as section 9 says "where browser-side interactivity is required".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-46). Use a shell and kit components (frontend/README.md).
// Built (27 Nov): the server page reads the current check-in / check-out times and cancellation tiers from
// GET /api/hotels/{id} (there is no GET for the policies alone) and the Client Component PoliciesForm saves them with
// PUT .../policies. Loading skeleton; errors under the fields and the tier rows.
import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { PoliciesForm, type HotelPolicies } from "@/components/app/hotel-dashboard/policies-form";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Hotel policies", robots: { index: false } };

async function PoliciesData({ hotelId }: { hotelId: string }) {
  const hotel = await backendJson<HotelPolicies>(`/api/hotels/${encodeURIComponent(hotelId)}`);
  if (!hotel) throw new Error("Could not load the policies of your hotel");

  return (
    <PoliciesForm
      hotelId={hotelId}
      initial={{
        checkInTime: hotel.checkInTime,
        checkOutTime: hotel.checkOutTime,
        cancellationTiers: hotel.cancellationTiers,
      }}
    />
  );
}

function PoliciesSkeleton() {
  return (
    <div className="grid max-w-2xl gap-6" role="status" aria-label="Loading policies">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export default async function Page() {
  const user = await requireUser(["hotel_moderator"]);
  if (!user.hotelId) throw new Error("This moderator account has no hotel");
  const unread = await getUnreadCount();

  return (
    <DashboardShell user={user} unreadNotifications={unread}>
      <PageHeader
        title="Hotel policies"
        description="Check-in and check-out times, and how much guests get back when they cancel. Guests see them before they pay."
      />
      <Suspense fallback={<PoliciesSkeleton />}>
        <PoliciesData hotelId={user.hotelId} />
      </Suspense>
    </DashboardShell>
  );
}
