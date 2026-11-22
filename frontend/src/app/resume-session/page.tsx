// /resume-session?returnTo=/bookings
// requireUser() sends the browser here when a protected page found no valid access cookie.
// The access token lasts 15 minutes but the session lasts 30 minutes idle (ACC-06, ACC-19),
// so we try ONE refresh: success -> back to the page; failure -> login, then back (ACC-10).
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
