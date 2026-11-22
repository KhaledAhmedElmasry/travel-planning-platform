// Page frame for guests and public content (home, search, blog, public itineraries).
// <PublicShell user={user}>...page content...</PublicShell>
// Pass `user` when someone is logged in so the header shows their menu instead of
// Log in / Sign up (public pages are viewed by guests AND users).
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/layout/mobile-nav";
import { TopNavLinks } from "@/components/layout/nav-links";
import { NotificationBell } from "@/components/layout/notification-bell";
import { SiteFooter } from "@/components/layout/site-footer";
import { SkipLink } from "@/components/layout/skip-link";
import { UserMenu } from "@/components/layout/user-menu";
import { Wordmark } from "@/components/layout/wordmark";
import { GUEST_NAV, USER_NAV } from "@/lib/nav";
import type { SessionUser } from "@/lib/session";

type PublicShellProps = {
  children: ReactNode;
  user?: SessionUser | null;
  unreadNotifications?: number;
  /** Full-width content (home hero). Default keeps the 1200px content width. */
  fullWidth?: boolean;
};

export function PublicShell({ children, user, unreadNotifications, fullWidth = false }: PublicShellProps) {
  const items = user?.role === "user" ? USER_NAV : GUEST_NAV;
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          <MobileNav
            items={items}
            className="lg:hidden"
            footer={
              !user && (
                <>
                  <Button asChild variant="secondary">
                    <Link href="/login">Log in</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/signup">Sign up</Link>
                  </Button>
                </>
              )
            }
          />
          <Wordmark />
          <nav aria-label="Main" className="hidden min-w-0 flex-1 lg:block">
            <TopNavLinks items={items} />
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <NotificationBell unread={unreadNotifications} />
                <UserMenu user={user} />
              </>
            ) : (
              <>
                <Button asChild variant="ghost" className="hidden sm:inline-flex">
                  <Link href="/login">Log in</Link>
                </Button>
                <Button asChild>
                  <Link href="/signup">Sign up</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className={cn("flex-1 outline-none", !fullWidth && "mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8")}
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
