// P-08 (Bonus) Verify email: /verify-email
// Part: Lead (foundation)
// Requirements: ACC-02
// Endpoints: GET /api/auth/verify-email
// Rendering: Dynamic SSR. Not in .md section 9, decided by the team leader (23 Nov): the token in the URL is checked against the backend on every request; nothing to cache.
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-08 (Bonus)). Use a shell and kit components (frontend/README.md).
// Team leader (24 Nov): checked on load; one failure state with the backend message (the backend
// gives one 400 for invalid, expired or used); no resend; "Log in" for guests, "Go to home" when logged in.
import type { Metadata } from "next";
import Link from "next/link";
import { So3ad } from "@/components/app/so3ad";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { HOME_FOR_ROLE } from "@/lib/nav";
import { backendFetch } from "@/lib/server/backend";
import { getSessionUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Verify email", robots: { index: false, follow: false } };

// Same text as the backend's 400, for a link that has no token at all.
const INVALID_LINK = "The token is invalid, expired or already used.";

type Result = { ok: boolean; message: string };

async function verify(token: string): Promise<Result> {
  const res = await backendFetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  if (res.ok) return { ok: true, message: body?.message ?? "Email verified." };
  if (res.status === 400) return { ok: false, message: body?.message ?? INVALID_LINK };
  // Anything else is not the link's fault: show the error page with its retry button.
  throw new Error(`GET /api/auth/verify-email failed with ${res.status}`);
}

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  const result = typeof token === "string" && token ? await verify(token) : { ok: false, message: INVALID_LINK };
  const user = await getSessionUser();
  const next = user ? (
    <Link href={HOME_FOR_ROLE[user.role]}>Go to home</Link>
  ) : (
    <Link href="/login">Log in</Link>
  );

  return (
    <AuthLayout title={result.ok ? "Email verified" : "Link not valid"}>
      <div className="grid gap-4">
        {result.ok && <So3ad pose="wave" size={120} className="justify-self-center lg:hidden" />}
        <p>{result.message}</p>
        {!result.ok && (
          <p className="text-muted-foreground">
            {user ? "If you already verified, you can ignore this link." : "If you already verified, you can log in."}
          </p>
        )}
        <Button asChild>{next}</Button>
      </div>
    </AuthLayout>
  );
}
