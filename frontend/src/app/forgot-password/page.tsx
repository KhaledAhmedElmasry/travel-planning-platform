// P-09 (Bonus) Forgot password: /forgot-password
// Part: Lead (foundation)
// Requirements: ACC-07
// Endpoints: POST /api/auth/forgot-password
// Rendering: Static + Client Component form. Not in .md section 9, decided by the team leader (23 Nov): same page for every visitor and no per-user data on the server, so it is prerendered; the form is a Client Component that submits from the browser (if it reads the URL with useSearchParams, wrap it in <Suspense>, Next.js 16 docs).
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-09 (Bonus)). Use a shell and kit components (frontend/README.md).
// Team leader (24 Nov): no email prefill; logged-in visitors may open it too.
import type { Metadata } from "next";
import { AuthLayout } from "@/components/layout/auth-layout";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <AuthLayout title="Forgot password" description="Enter your email and we will send you a link to choose a new password.">
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
