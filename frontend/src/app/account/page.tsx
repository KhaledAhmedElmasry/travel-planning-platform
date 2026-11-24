// P-05, P-06 Profile: /account
// Part: Lead (foundation)
// Requirements: ACC-09, ACC-11, ACC-12, GEN-12
// Endpoints: GET, PATCH, DELETE /api/users/me; GET /api/currencies
// Rendering: Dynamic SSR + Client Components. Not in .md section 9, decided by the team leader (23 Nov): per-user data read with the session cookie on every request, so it can't be cached for everyone; the edit form and the deactivate dialog are Client Components.
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-05, P-06). Use a shell and kit components (frontend/README.md).
// Frame (team leader, 23 Nov): AppShell for travelers, DashboardShell for admins and moderators.
// Deactivation (P-06) is for registered users only (ACC-12).
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";
import { DeactivateAccountSection } from "./deactivate-account";
import { ProfileForm, type Currency, type Profile } from "./profile-form";

export const metadata: Metadata = { title: "Profile", robots: { index: false } };

const ALL_ROLES = ["user", "admin", "airline_moderator", "hotel_moderator"] as const;

type CurrencyPage = { items: Currency[]; totalPages: number };

async function allCurrencies(): Promise<Currency[]> {
  const items: Currency[] = [];
  for (let page = 1; ; page++) {
    const res = await backendJson<CurrencyPage>(`/api/currencies?page=${page}`);
    items.push(...(res?.items ?? []));
    if (!res || page >= res.totalPages) return items;
  }
}

export default async function Page() {
  const user = await requireUser(ALL_ROLES);
  const [profile, currencies, unread] = await Promise.all([
    backendJson<Profile>("/api/users/me"),
    allCurrencies(),
    getUnreadCount(),
  ]);
  if (!profile) throw new Error("Could not load your profile");

  const content = (
    <div className="grid max-w-md gap-10">
      <div>
        <PageHeader title="Profile" />
        <ProfileForm profile={profile} currencies={currencies} />
        <Link href="/account/password" className="mt-6 inline-block text-sm text-link underline underline-offset-4">
          Change password
        </Link>
      </div>
      {user.role === "user" && (
        <section aria-labelledby="deactivate-heading" className="grid gap-3 rounded-xl border border-error/40 p-6">
          <h2 id="deactivate-heading" className="text-lg font-semibold">
            Deactivate account
          </h2>
          <p className="text-sm text-muted-foreground">
            You can deactivate your account when you have no upcoming confirmed bookings.
          </p>
          <div>
            <DeactivateAccountSection />
          </div>
        </section>
      )}
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
