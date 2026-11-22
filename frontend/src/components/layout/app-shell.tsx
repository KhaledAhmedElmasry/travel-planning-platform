// Page frame for logged-in travelers (Registered User pages: bookings, itineraries,
// my posts, profile, booking wizard). Top navbar only (Khaled's decision, Q9).
// <AppShell user={user} unreadNotifications={3}>...page content...</AppShell>
// It is PublicShell with a required user: one header for the whole traveler side,
// so navigation never changes place between pages (GEN-14).
import type { ReactNode } from "react";
import { PublicShell } from "@/components/layout/public-shell";
import type { SessionUser } from "@/lib/session";

type AppShellProps = {
  children: ReactNode;
  user: SessionUser;
  unreadNotifications?: number;
};

export function AppShell({ children, user, unreadNotifications }: AppShellProps) {
  return (
    <PublicShell user={user} unreadNotifications={unreadNotifications}>
      {children}
    </PublicShell>
  );
}
