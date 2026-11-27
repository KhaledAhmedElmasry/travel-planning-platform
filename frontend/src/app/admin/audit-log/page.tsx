// P-53 Audit log: /admin/audit-log
// Part: T7 Admin dashboard
// Requirements: GEN-07
// Endpoints: GET /api/admin/audit-logs
// Rendering: Dynamic SSR. Source: .md section 9 "Admin / Moderator Dashboards".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-53). Use a shell and kit components (frontend/README.md).
import type { Metadata } from "next";
import { Suspense } from "react";
import { AuditLogTable, type AuditLogFilters, type AuditLogList } from "@/components/app/admin/audit-log-table";
import { PageHeader } from "@/components/app/page-header";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Audit log", robots: { index: false } };

type SearchParams = {
  page?: string | string[];
  action?: string | string[];
  from?: string | string[];
  to?: string | string[];
};

const ACTIONS = [
  "create_moderator",
  "suspend_account",
  "reactivate_account",
  "reset_password",
  "dismiss_report",
  "hide_content",
  "delete_content",
  "deactivate_airline",
  "reactivate_airline",
  "deactivate_hotel",
  "reactivate_hotel",
] as const;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function validDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value ? "" : value;
}

function parseFilters(searchParams: SearchParams): AuditLogFilters {
  const rawPage = Number(first(searchParams.page));
  const rawAction = first(searchParams.action);
  return {
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    action: ACTIONS.includes(rawAction as (typeof ACTIONS)[number]) ? (rawAction as (typeof ACTIONS)[number]) : "",
    from: validDate(first(searchParams.from)),
    to: validDate(first(searchParams.to)),
  };
}

function apiPath(filters: AuditLogFilters): string {
  const params = new URLSearchParams({ page: String(filters.page) });
  if (filters.action) params.set("action", filters.action);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return `/api/admin/audit-logs?${params.toString()}`;
}

function AuditLogLoading() {
  return <div className="grid gap-6" aria-label="Loading audit log"><Skeleton className="h-24 w-full" /><Skeleton className="h-80 w-full" /></div>;
}

async function AuditLogContent({ filters }: { filters: AuditLogFilters }) {
  if (filters.from && filters.to && filters.from > filters.to) {
    return <AuditLogTable filters={filters} rangeError="From date must not be after to date" />;
  }
  const auditLogs = await backendJson<AuditLogList>(apiPath(filters));
  if (!auditLogs) throw new Error("Could not load audit log");
  return <AuditLogTable filters={filters} auditLogs={auditLogs} />;
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser(["admin"]);
  const filters = parseFilters(await searchParams);
  const unread = await getUnreadCount();
  return (
    <DashboardShell user={user} unreadNotifications={unread}>
      <div className="grid gap-6">
        <PageHeader title="Audit log" description="Review administrative actions across the platform." />
        <Suspense fallback={<AuditLogLoading />}>
          <AuditLogContent filters={filters} />
        </Suspense>
      </div>
    </DashboardShell>
  );
}
