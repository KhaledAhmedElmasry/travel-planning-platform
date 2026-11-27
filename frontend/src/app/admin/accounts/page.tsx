// P-48 Accounts: /admin/accounts
// Part: T7 Admin dashboard
// Requirements: ACC-14, ACC-15, ACC-16, ACC-07a
// Endpoints: POST /api/admin/users/{id}/reset-password; GET /api/admin/accounts; PATCH /api/admin/accounts/{id}/suspend; PATCH /api/admin/accounts/{id}/reactivate
// Rendering: Dynamic SSR + Client Components. Source: .md section 9 "Admin / Moderator Dashboards"; Client Components for the interactive form, as section 9 says "where browser-side interactivity is required".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-48). Use a shell and kit components (frontend/README.md).
import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountsTable, type AccountList } from "@/components/app/admin/accounts-table";
import { PageHeader } from "@/components/app/page-header";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Accounts", robots: { index: false } };

type SearchParams = { page?: string | string[]; search?: string | string[]; role?: string | string[]; status?: string | string[] };
type AccountFilters = { page: number; search: string; role: "user" | "admin" | "airline_moderator" | "hotel_moderator" | ""; status: "active" | "suspended" | "deactivated" | "" };

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function accountFilters(searchParams: SearchParams): AccountFilters {
  const rawPage = Number(first(searchParams.page));
  const role = first(searchParams.role);
  const status = first(searchParams.status);
  return {
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    search: first(searchParams.search),
    role: ["user", "admin", "airline_moderator", "hotel_moderator"].includes(role) ? (role as AccountFilters["role"]) : "",
    status: ["active", "suspended", "deactivated"].includes(status) ? (status as AccountFilters["status"]) : "",
  };
}

function accountPath(filters: AccountFilters): string {
  const params = new URLSearchParams({ page: String(filters.page) });
  if (filters.search) params.set("search", filters.search);
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  return `/api/admin/accounts?${params.toString()}`;
}

function AccountsLoading() {
  return <div className="grid gap-6" aria-label="Loading accounts"><Skeleton className="h-11 w-full" /><Skeleton className="h-80 w-full" /></div>;
}

async function AccountsContent({ filters }: { filters: AccountFilters }) {
  const accounts = await backendJson<AccountList>(accountPath(filters));
  if (!accounts) throw new Error("Could not load accounts");
  return <AccountsTable accounts={accounts} filters={filters} />;
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser(["admin"]);
  const filters = accountFilters(await searchParams);
  const unread = await getUnreadCount();
  return <DashboardShell user={user} unreadNotifications={unread}><div className="grid gap-6"><PageHeader title="Accounts" description="Manage registered users and moderator accounts." /><Suspense fallback={<AccountsLoading />}><AccountsContent filters={filters} /></Suspense></div></DashboardShell>;
}
