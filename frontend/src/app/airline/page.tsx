// - Airline overview: /airline
// Part: Lead (foundation)
// Requirements: ACC-04 (role home)
// Endpoints: GET /api/airlines/{id}/flights
// Rendering: Dynamic SSR. Source: .md section 9 "Admin / Moderator Dashboards".
// Spec: MILESTONE2_FRONTEND_SPEC.md section 2, Airline Moderator row. The moderator's airline is
// `airlineId` from GET /api/auth/me (ACC-13).
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { allPages } from "@/lib/all-pages";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";
import { AirlineOverview, type AirlineFlight } from "./airline-overview";

export const metadata: Metadata = { title: "Airline overview", robots: { index: false } };

export default async function Page() {
  const user = await requireUser(["airline_moderator"]);
  if (!user.airlineId) throw new Error("This moderator account has no airline");
  const [flights, unread] = await Promise.all([
    allPages((page) =>
      backendJson<{ items: AirlineFlight[]; totalPages: number }>(
        `/api/airlines/${encodeURIComponent(user.airlineId!)}/flights?status=scheduled&page=${page}`,
      ),
    ),
    getUnreadCount(),
  ]);

  return (
    <DashboardShell user={user} unreadNotifications={unread}>
      <PageHeader title="Airline overview" />
      <AirlineOverview flights={flights} />
    </DashboardShell>
  );
}
