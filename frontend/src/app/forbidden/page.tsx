// /forbidden: a logged-in account opened a page its role can't use (ACC-11), e.g. a traveler on
// /admin. requireUser() sends it here. The backend refuses the data anyway (403/404).
// Rendering: Dynamic SSR. Not in .md section 9, chosen with the kit (#259): it reads the session cookie to link the account to its own home page.
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { So3ad } from "@/components/app/so3ad";
import { PublicShell } from "@/components/layout/public-shell";
import { HOME_FOR_ROLE } from "@/lib/nav";
import { getSessionUser, getUnreadCount } from "@/lib/server/session";

export const metadata: Metadata = { title: "No access", robots: { index: false } };

export default async function ForbiddenPage() {
  const user = await getSessionUser();
  const unread = user ? await getUnreadCount() : 0;
  const home = user ? HOME_FOR_ROLE[user.role] : "/";
  return (
    <PublicShell user={user} unreadNotifications={unread}>
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <So3ad pose="sit" size={160} />
        <p className="tabular text-sm font-semibold tracking-widest text-cyan uppercase">Error 403</p>
        <h1 className="text-3xl font-bold">This page isn&rsquo;t for your account</h1>
        <p className="max-w-prose text-muted-foreground">
          You&rsquo;re logged in, but your role can&rsquo;t open this page. Go back to your own home page.
        </p>
        <Button asChild className="mt-2">
          <Link href={home}>Go to my home page</Link>
        </Button>
      </div>
    </PublicShell>
  );
}
