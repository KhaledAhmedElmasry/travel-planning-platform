"use client";

// The top header of PublicShell / AppShell: menu, bell and profile menu, or Log in / Sign up.
// `user`:
//   SessionUser -> logged in (the page already knows, e.g. a server-rendered page);
//   null        -> the page knows it is a guest;
//   undefined   -> the page doesn't know (static / ISR pages such as a published post): the header
//                  asks GET /api/auth/me itself after loading, so cached pages still show the
//                  right menu to each visitor.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/layout/mobile-nav";
import { TopNavLinks } from "@/components/layout/nav-links";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { Wordmark } from "@/components/layout/wordmark";
import { apiFetch } from "@/lib/api";
import { GUEST_NAV, USER_NAV } from "@/lib/nav";
import type { SessionUser } from "@/lib/session";

type SiteHeaderProps = {
  user?: SessionUser | null;
  unreadNotifications?: number;
};

export function SiteHeader({ user: given, unreadNotifications }: SiteHeaderProps) {
  const [found, setFound] = useState<SessionUser | null | undefined>(undefined);
  const [foundUnread, setFoundUnread] = useState(0);
  // The page's answer wins; otherwise what the header found out itself.
  const user = given !== undefined ? given : found;
  const unread = given !== undefined ? (unreadNotifications ?? 0) : foundUnread;

  useEffect(() => {
    if (given !== undefined) return; // the page told us
    let cancelled = false;
    (async () => {
      try {
        // apiFetch refreshes an expired access token once (the session may still be alive).
        const me = await apiFetch<SessionUser>("/api/auth/me", { redirectOnAuthFail: false });
        if (cancelled) return;
        setFound(me);
        const count = await apiFetch<{ count?: number }>("/api/notifications/unread-count", {
          redirectOnAuthFail: false,
        }).catch(() => ({ count: 0 }));
        if (!cancelled) setFoundUnread(count.count ?? 0);
      } catch {
        if (!cancelled) setFound(null); // 401 after a refresh attempt: a guest
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [given]);

  const items = user?.role === "user" ? USER_NAV : GUEST_NAV;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <MobileNav
          items={items}
          className="lg:hidden"
          footer={
            user === null && (
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
        <div className="ml-auto flex min-h-11 items-center gap-2">
          {user ? (
            <>
              <NotificationBell unread={unread} />
              <UserMenu user={user} />
            </>
          ) : user === null ? (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          ) : (
            // still checking: keep the space so the header doesn't jump (no flash of "Log in")
            <span className="h-11 w-24" aria-hidden="true" />
          )}
        </div>
      </div>
    </header>
  );
}
