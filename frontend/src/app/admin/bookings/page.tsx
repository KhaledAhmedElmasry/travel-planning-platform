// P-51 All bookings: /admin/bookings
// Part: T7 Admin dashboard
// Requirements: ACC-17
// Endpoints: GET /api/admin/bookings
// Rendering: Dynamic SSR. Source: .md section 9 "Admin / Moderator Dashboards".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-51). Use a shell and kit components (frontend/README.md).
import type { Metadata } from "next";
import { Suspense } from "react";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { FormField } from "@/components/app/form-field";
import { PageHeader } from "@/components/app/page-header";
import { PaginationBar } from "@/components/app/pagination-bar";
import { Price } from "@/components/app/price";
import { StatusBadge } from "@/components/app/status-badge";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDay } from "@/lib/dates";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "All bookings", robots: { index: false } };
type SearchParams = { type?: string | string[]; status?: string | string[]; from?: string | string[]; to?: string | string[]; page?: string | string[] };
type Filters = { type: "" | "flight" | "hotel"; status: string; from: string; to: string; page: number };
type Booking = { id: string; type: string; reference: string | null; user: { name: string }; provider: { name: string }; dates: { from: string; to: string; startDate?: string; endDate?: string }; amount: number; currency: string; status: "pending_payment" | "confirmed" | "completed" | "expired" | "cancelled" };
type BookingList = { items: Booking[]; page: number; pageSize: number; total: number; totalPages: number };
const statuses = ["pending_payment", "confirmed", "completed", "expired", "cancelled"];
function first(v?: string | string[]) { return Array.isArray(v) ? v[0] ?? "" : v ?? ""; }
function filtersFrom(s: SearchParams): Filters {
 const type = first(s.type), status = first(s.status), rawPage = Number(first(s.page));
 const date = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
 return { type: type === "flight" || type === "hotel" ? type : "", status: statuses.includes(status) ? status : "", from: date(first(s.from)), to: date(first(s.to)), page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1 };
}
function query(f: Filters, page = f.page) { const p = new URLSearchParams(); if (f.type) p.set("type", f.type); if (f.status) p.set("status", f.status); if (f.from) p.set("from", f.from); if (f.to) p.set("to", f.to); p.set("page", String(page)); return p.toString(); }
function Loading() { return <div className="grid gap-4" aria-label="Loading bookings"><Skeleton className="h-20 w-full"/><Skeleton className="h-80 w-full"/></div>; }
async function Content({ f, reversed }: { f: Filters; reversed: boolean }) {
 if (reversed) return <EmptyState title="From date must not be after to date" />;
 const data = await backendJson<BookingList>(`/api/admin/bookings?${query(f)}`);
 if (!data) throw new Error("Could not load bookings");
 const filtered = Boolean(f.type || f.status || f.from || f.to);
 const dateText = (b: Booking) => `${formatDay(b.dates.startDate ?? b.dates.from)} – ${formatDay(b.dates.endDate ?? b.dates.to)}`;
 return <><DataTable caption="All bookings" rows={data.items} rowKey={(b) => b.id} empty={<EmptyState title={filtered ? "No bookings match these filters" : "No bookings yet"}/>} columns={[
  { header: "Reference", cell: (b) => b.reference ?? "-" }, { header: "User", cell: (b) => b.user.name }, { header: "Provider", cell: (b) => b.provider.name, hideOnMobile: true }, { header: "Dates", cell: dateText, hideOnMobile: true }, { header: "Amount", cell: (b) => <Price cents={b.amount} currency={b.currency} size="sm" />, align: "end" }, { header: "Status", cell: (b) => <StatusBadge kind="booking" status={b.status}/> }
 ]}/><PaginationBar page={data.page} totalPages={data.totalPages} total={data.total} pageSize={10} hrefFor={(page) => `/admin/bookings?${query(f, page)}`}/></>;
}
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
 const user = await requireUser(["admin"]), f = filtersFrom(await searchParams), unread = await getUnreadCount();
 const reversed = Boolean(f.from && f.to && f.from > f.to);
 return <DashboardShell user={user} unreadNotifications={unread}><div className="grid gap-6"><PageHeader title="All bookings"/><form key={`${f.type}-${f.status}-${f.from}-${f.to}`} method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
  <FormField label="Type" name="type"><Select name="type" defaultValue={f.type || "all"}><SelectTrigger aria-label="Type"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="flight">Flight</SelectItem><SelectItem value="hotel">Hotel</SelectItem></SelectContent></Select></FormField>
  <FormField label="Status" name="status"><Select name="status" defaultValue={f.status || "all"}><SelectTrigger aria-label="Status"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{statuses.map((s) => <SelectItem key={s} value={s}>{s.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></FormField>
  <FormField label="From" name="from"><Input type="date" name="from" defaultValue={f.from}/></FormField>
  <FormField label="To" name="to" error={reversed ? "From date must not be after to date" : undefined}><Input type="date" name="to" defaultValue={f.to}/></FormField>
  <div className="flex items-end gap-2"><Button type="submit">Apply</Button><Button variant="outline" asChild><a href="/admin/bookings">Clear filters</a></Button></div>
 </form><Suspense fallback={<Loading/>}><Content f={f} reversed={reversed}/></Suspense></div></DashboardShell>;
}
