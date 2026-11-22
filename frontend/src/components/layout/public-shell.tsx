// Page frame for guests and public content (home, search, blog, public itineraries).
//   Server-rendered page that knows the visitor:  <PublicShell user={await getSessionUser()}>
//   Static / ISR page (published post, author page, public itinerary): <PublicShell> without `user`;
//   the header then checks the session in the browser, so the page itself can be cached.
// See SiteHeader for the details.
import type { ReactNode } from "react";
import { cn } from "cn";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SkipLink } from "@/components/layout/skip-link";
import type { SessionUser } from "@/lib/session";

type PublicShellProps = {
  children: ReactNode;
  /** SessionUser = logged in, null = guest, left out = let the header find out (static pages). */
  user?: SessionUser | null;
  unreadNotifications?: number;
  /** Full-width content (home hero). Default keeps the 1200px content width. */
  fullWidth?: boolean;
};

export function PublicShell({ children, user, unreadNotifications, fullWidth = false }: PublicShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <SiteHeader user={user} unreadNotifications={unreadNotifications} />
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
