// P-03, P-04 Change password: /account/password
// Part: Lead (foundation)
// Requirements: ACC-07a, ACC-13, ACC-08
// Endpoints: PATCH /api/auth/change-password
// Rendering: Dynamic SSR + Client Components. Not in .md section 9, decided by the team leader (23 Nov): per-user data read with the session cookie on every request, so it can't be cached for everyone (requireUser also routes forced password changes here); the form is a Client Component.
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-03, P-04). Use a shell and kit components (frontend/README.md).
// Frame (team leader, 23 Nov): forced change (temporary password) = AuthLayout, no menus;
// normal change = AppShell for travelers, DashboardShell for admins and moderators.
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { AuthLayout } from "@/components/layout/auth-layout";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getUnreadCount, requireUser } from "@/lib/server/session";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Change password" };

const ALL_ROLES = ["user", "admin", "airline_moderator", "hotel_moderator"] as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const user = await requireUser(ALL_ROLES, { allowPendingPasswordChange: true });
  const { returnTo } = await searchParams;

  if (user.mustChangePassword) {
    return (
      <AuthLayout title="Set a new password">
        <PasswordForm forced role={user.role} returnTo={returnTo} />
      </AuthLayout>
    );
  }

  const content = (
    <div className="max-w-md">
      <PageHeader title="Change password" />
      <PasswordForm forced={false} role={user.role} />
    </div>
  );
  const unread = await getUnreadCount();
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
