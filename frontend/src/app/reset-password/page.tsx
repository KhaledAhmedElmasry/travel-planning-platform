// P-10 (Bonus) Reset password: /reset-password
// Part: Lead (foundation)
// Requirements: ACC-07
// Endpoints: POST /api/auth/reset-password
// Rendering: Static + Client Component form. Not in .md section 9, decided by the team leader (23 Nov): same page for every visitor and no per-user data on the server, so it is prerendered; the form is a Client Component that submits from the browser (if it reads the URL with useSearchParams, wrap it in <Suspense>, Next.js 16 docs); the reset token comes from the URL.
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-10 (Bonus)). Use a shell and kit components (frontend/README.md).
import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthLayout } from "@/components/layout/auth-layout";
import { ResetPasswordFormFromUrl } from "./reset-password-form";

export const metadata: Metadata = { title: "Reset password", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <AuthLayout title="Reset password">
      <Suspense fallback={null}>
        <ResetPasswordFormFromUrl />
      </Suspense>
    </AuthLayout>
  );
}
