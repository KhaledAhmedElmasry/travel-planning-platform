// P-02 Log in: /login
// Part: Lead (foundation)
// Requirements: ACC-04, ACC-05, ACC-10
// Endpoints: POST /api/auth/login
// Rendering: Static + Client Component form. Not in .md section 9, decided by the team leader (23 Nov): same page for every visitor and no per-user data on the server, so it is prerendered; the form is a Client Component that submits from the browser (if it reads the URL with useSearchParams, wrap it in <Suspense>, Next.js 16 docs).
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-02). Use a shell and kit components (frontend/README.md).
import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthLayout } from "@/components/layout/auth-layout";
import { LoginFormFromUrl } from "./login-form";

const DESCRIPTION = "Log in to Yallaway to book flights and hotels, plan itineraries and share your trips.";

export const metadata: Metadata = {
  title: "Log in",
  description: DESCRIPTION,
  alternates: { canonical: "/login" },
  openGraph: { type: "website", siteName: "Yallaway", title: "Log in", description: DESCRIPTION },
};

export default function Page() {
  return (
    <AuthLayout title="Log in">
      <Suspense fallback={null}>
        <LoginFormFromUrl />
      </Suspense>
    </AuthLayout>
  );
}
