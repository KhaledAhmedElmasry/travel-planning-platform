// - Admin overview: /admin
// Part: Lead (foundation)
// Requirements: ACC-04 (role home)
// Endpoints: GET /api/admin/accounts; GET /api/admin/reports; GET /api/admin/audit-logs
// Rendering: Dynamic SSR. Source: .md section 9 "Admin / Moderator Dashboards".
// Spec: MILESTONE2_FRONTEND_SPEC.md section 2, Admin row ("Good to know": the `total` of
// GET /api/admin/accounts?role=&status= and GET /api/admin/reports?status=open give the counts).
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";
import { AdminOverview, type AuditEntry, type OpenReport } from "./admin-overview";

export const metadata: Metadata = { title: "Admin overview", robots: { index: false } };

type Page<T> = { items: T[]; total: number };

const total = async (query: string) => (await backendJson<Page<unknown>>(`/api/admin/accounts?${query}`))?.total ?? 0;

export default async function Page() {
  const user = await requireUser(["admin"]);
  const [reports, users, airlineModerators, hotelModerators, suspended, audit, unread] = await Promise.all([
    backendJson<Page<OpenReport>>("/api/admin/reports?status=open"),
    total("role=user"),
    total("role=airline_moderator"),
    total("role=hotel_moderator"),
    total("status=suspended"),
    backendJson<Page<AuditEntry>>("/api/admin/audit-logs"),
    getUnreadCount(),
  ]);

  return (
    <DashboardShell user={user} unreadNotifications={unread}>
      <PageHeader title="Admin overview" />
      <AdminOverview
        openReports={reports?.items ?? []}
        openReportsTotal={reports?.total ?? 0}
        accounts={{ users, moderators: airlineModerators + hotelModerators, suspended }}
        audit={audit?.items ?? []}
      />
    </DashboardShell>
  );
}
