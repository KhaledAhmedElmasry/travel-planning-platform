// P-01 Sign up: /signup
// Part: Lead (foundation)
// Requirements: ACC-01, ACC-02 (Bonus banner), ACC-18
// Endpoints: POST /api/auth/register
// Rendering: Static + Client Component form. Not in .md section 9, decided by the team leader (23 Nov): same page for every visitor and no per-user data on the server, so it is prerendered; the form is a Client Component that submits from the browser (if it reads the URL with useSearchParams, wrap it in <Suspense>, Next.js 16 docs).
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-01). Use a shell and kit components (frontend/README.md).
// ACC-18: there is no role field; every sign-up is a Registered User (admins are seeded only).
import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthLayout } from "@/components/layout/auth-layout";
import { SignupFormFromUrl } from "./signup-form";

export const metadata: Metadata = { title: "Sign up" };

export default function Page() {
  return (
    <AuthLayout title="Sign up">
      <Suspense fallback={null}>
        <SignupFormFromUrl />
      </Suspense>
    </AuthLayout>
  );
}
