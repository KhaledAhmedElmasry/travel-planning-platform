"use client";

// P-02 form (ACC-04, ACC-05, ACC-10). Shows the backend's message on failure (team leader, 23 Nov).
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormErrorSummary } from "@/components/app/form-error-summary";
import { FormField } from "@/components/app/form-field";
import { PasswordInput } from "@/components/app/password-input";
import { So3ad } from "@/components/app/so3ad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api";
import { fieldErrorMap } from "@/lib/api-error";
import { afterLoginPath, safeReturnTo } from "@/lib/return-to";
import type { Role } from "@/lib/session";

type LoginResponse = { role: Role; mustChangePassword: boolean };

type LoginFormProps = {
  returnTo?: string | null;
  /** Full page load by default, so server components read the new session cookie. */
  navigate?: (path: string) => void;
};

/** Reads ?returnTo= from the URL (ACC-10). Render inside <Suspense> so the page stays static. */
export function LoginFormFromUrl() {
  return <LoginForm returnTo={useSearchParams().get("returnTo")} />;
}

export function LoginForm({ returnTo, navigate = (path) => window.location.assign(path) }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const safe = safeReturnTo(returnTo);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    let account: LoginResponse;
    try {
      account = await apiFetch<LoginResponse>("/api/auth/login", { method: "POST", json: { email, password } });
    } catch (err) {
      setSubmitting(false);
      if (!(err instanceof ApiError)) throw err;
      setError({ message: err.message, fields: fieldErrorMap(err.body) });
      return;
    }
    if (account.mustChangePassword) {
      // ACC-07a / ACC-13: set a new password first, then continue to the pending action.
      navigate(safe ? `/account/password?returnTo=${encodeURIComponent(safe)}` : "/account/password");
      return;
    }
    navigate(afterLoginPath(account.role, returnTo));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {/* Sent here from a restricted action (ACC-10): So3ad holds the key (MASTER.md section 9). */}
      {safe && (
        <div className="flex items-center gap-3">
          <So3ad pose="key" size={56} />
          <p className="rounded-2xl rounded-bl-sm border border-border bg-muted px-3 py-1.5 text-sm font-semibold">
            &ldquo;Log in first, habibi.&rdquo;
          </p>
        </div>
      )}
      {error && (
        <FormErrorSummary
          message={error.message}
          errors={error.fields}
          labels={{ email: "Email", password: "Password" }}
        />
      )}
      <FormField label="Email" name="email" required error={error?.fields.email}>
        <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </FormField>
      <FormField label="Password" name="password" required error={error?.fields.password}>
        <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </FormField>
      <Link href="/forgot-password" className="justify-self-end text-sm text-link underline underline-offset-4">
        Forgot password?
      </Link>
      <Button type="submit" loading={submitting}>
        Log in
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href={safe ? `/signup?returnTo=${encodeURIComponent(safe)}` : "/signup"} className="text-link underline underline-offset-4">
          Sign up
        </Link>
      </p>
    </form>
  );
}
