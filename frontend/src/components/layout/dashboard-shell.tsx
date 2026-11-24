"use client";

// Page frame for airline moderators, hotel moderators and the admin (Dynamic SSR
// dashboards, .md section 9). Left sidebar on large screens, slide-in menu below 1024px.
// <DashboardShell user={user} unreadNotifications={2}>...page content...</DashboardShell>
// Client Component: the menu icons are components (functions), which a Server Component cannot pass to the client menus.
// The sidebar items come from DASHBOARD_NAV[user.role] in src/lib/nav.ts.
import type { ReactNode } from "react";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SideNavLinks } from "@/components/layout/nav-links";
import { NotificationBell } from "@/components/layout/notification-bell";
import { SkipLink } from "@/components/layout/skip-link";
import { UserMenu } from "@/components/layout/user-menu";
import { Wordmark } from "@/components/layout/wordmark";
import { DASHBOARD_NAV, HOME_FOR_ROLE } from "@/lib/nav";
import { ROLE_LABEL, type SessionUser } from "@/lib/session";

type DashboardShellProps = {
  children: ReactNode;
  user: SessionUser & { role: "admin" | "airline_moderator" | "hotel_moderator" };
  unreadNotifications?: number;
};

export function DashboardShell({ children, user, unreadNotifications }: DashboardShellProps) {
  const items = DASHBOARD_NAV[user.role];
  const home = HOME_FOR_ROLE[user.role];
  return (
    <div className="flex min-h-dvh">
      <SkipLink />
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        <Wordmark href={home} className="px-2 pt-1" />
        <nav aria-label="Dashboard">
          <SideNavLinks items={items} />
        </nav>
        <p className="mt-auto px-2 text-[13px] text-subtle-foreground">{ROLE_LABEL[user.role]}</p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur sm:px-6">
          <MobileNav items={items} className="lg:hidden" />
          <Wordmark href={home} className="lg:hidden" />
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell unread={unreadNotifications} />
            <UserMenu user={user} />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 outline-none sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
