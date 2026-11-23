// /resume-session?returnTo=/bookings
// requireUser() sends the browser here when a protected page found no valid access cookie.
// The access token lasts 15 minutes but the session lasts 30 minutes idle (ACC-06, ACC-19),
// so we try ONE refresh: success -> back to the page; failure -> login, then back (ACC-10).
// Rendering: Static + Client Component. Not in .md section 9, chosen with the kit (#259): same page for everyone; the Client Component reads ?returnTo (useSearchParams inside <Suspense>) and calls the refresh from the browser so the new cookies are set there.
import type { Metadata } from "next";
import { Suspense } from "react";
import { ResumeSession } from "./resume-session";

export const metadata: Metadata = { title: "Checking your session", robots: { index: false } };

export default function ResumeSessionPage() {
  return (
    <Suspense>
      <ResumeSession />
    </Suspense>
  );
}
