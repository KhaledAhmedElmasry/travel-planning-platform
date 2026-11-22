// SERVER ONLY. Who is logged in, for server-rendered pages (ACC-04, ACC-06, ACC-10, ACC-11, ACC-19).
//
// Public page that changes when someone is logged in (header menu):
//   const user = await getSessionUser();            // SessionUser | null
//   return <PublicShell user={user}>...</PublicShell>;
//
// Page only for some roles:
//   const user = await requireUser(["user"]);        // never returns for others
//   return <AppShell user={user}>...</AppShell>;
//
//   const user = await requireUser(["admin"]);
//   return <DashboardShell user={user}>...</DashboardShell>;
//
// requireUser() never returns without a user that has one of the roles:
// - no valid access cookie -> /resume-session, which refreshes the session once and comes back
//   (the access token lasts 15 minutes, the session 30 minutes idle), or goes to /login?returnTo=
//   so the user returns to this page after logging in (ACC-10);
// - wrong role -> /forbidden (ACC-11);
// - temporary password (ACC-07a, ACC-13) -> /account/password first.
// The backend still checks every request; this only decides what the page shows (GEN-13).
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { backendFetch, backendJson } from "@/lib/server/backend";
import type { Role, SessionUser } from "@/lib/session";
import { CURRENT_PATH_HEADER } from "@/lib/return-to";

/** The logged-in account from GET /api/auth/me, or null. Fetched once per request (React cache). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const res = await backendFetch("/api/auth/me");
  if (!res.ok) return null;
  return (await res.json()) as SessionUser;
});

/** Unread notifications for the header bell (GEN-01); 0 when not logged in or on error. */
export const getUnreadCount = cache(async (): Promise<number> => {
  try {
    const body = await backendJson<{ count?: number; unreadCount?: number }>(
      "/api/notifications/unread-count",
    );
    return body?.count ?? body?.unreadCount ?? 0;
  } catch {
    return 0;
  }
});

/** The page being rendered, e.g. "/bookings?tab=past" (set by src/proxy.ts). */
export async function currentPath(): Promise<string> {
  return (await headers()).get(CURRENT_PATH_HEADER) ?? "/";
}

type RequireOptions = {
  /** Only for the change-password page itself (a temporary password must be allowed there). */
  allowPendingPasswordChange?: boolean;
};

export async function requireUser<R extends Role>(
  roles: readonly R[],
  options: RequireOptions = {},
): Promise<SessionUser & { role: R }> {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/resume-session?returnTo=${encodeURIComponent(await currentPath())}`);
  }
  if (user.mustChangePassword && !options.allowPendingPasswordChange) {
    redirect("/account/password");
  }
  if (!(roles as readonly Role[]).includes(user.role)) {
    redirect("/forbidden");
  }
  return user as SessionUser & { role: R };
}
