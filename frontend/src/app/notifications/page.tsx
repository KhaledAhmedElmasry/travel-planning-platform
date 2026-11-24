// P-11 Notifications: /notifications
// Part: Lead (foundation)
// Requirements: GEN-01
// Endpoints: GET /api/notifications; PATCH /api/notifications/read-all; PATCH /api/notifications/{id}/read
// Rendering: Dynamic SSR + Client Components. Not in .md section 9, decided by the team leader (23 Nov): per-user data read with the session cookie on every request, so it can't be cached for everyone and must be fresh; mark-as-read buttons are Client Components.
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-11). Use a shell and kit components (frontend/README.md).
// Built (24 Nov): full paginated list (GEN-05, ?page=N), "Mark all as read", empty state; every logged-in role
// (AppShell for travelers, DashboardShell for admins and moderators, like /account).
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { PaginationBar } from "@/components/app/pagination-bar";
import type { AppNotification } from "@/components/app/shared/notification-item";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";
import { NotificationsSection } from "./notifications-list";

export const metadata: Metadata = { title: "Notifications" };

const ALL_ROLES = ["user", "admin", "airline_moderator", "hotel_moderator"] as const;

type NotificationPage = { items: AppNotification[]; page: number; pageSize: number; total: number; totalPages: number };

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const user = await requireUser(ALL_ROLES);
  const raw = Number((await searchParams).page);
  const page = Number.isInteger(raw) && raw > 0 ? raw : 1;
  const [data, unread] = await Promise.all([
    backendJson<NotificationPage>(`/api/notifications?page=${page}`),
    getUnreadCount(),
  ]);
  if (!data) throw new Error("Could not load your notifications");

  const content = (
    <div className="grid max-w-3xl gap-6">
      <PageHeader title="Notifications" />
      <NotificationsSection key={page} items={data.items} unread={unread} />
      <PaginationBar
        page={data.page}
        totalPages={data.totalPages}
        total={data.total}
        pageSize={data.pageSize}
        hrefFor={(p) => `/notifications?page=${p}`}
      />
    </div>
  );

  return user.role === "user" ? (
    <AppShell user={user} unreadNotifications={unread}>
      {content}
    </AppShell>
  ) : (
    <DashboardShell user={user as typeof user & { role: "admin" | "airline_moderator" | "hotel_moderator" }} unreadNotifications={unread}>
      {content}
    </DashboardShell>
  );
}
