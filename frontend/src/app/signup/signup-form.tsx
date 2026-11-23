"use client";

// P-01 form (ACC-01). After the account is created we log in with the same email and password
// and go to /home or the pending action (team leader, 23 Nov; ACC-10). The backend has already
// sent the verification email, so a toast says so (ACC-02 bonus).
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormErrorSummary } from "@/components/app/form-error-summary";
import { FormField } from "@/components/app/form-field";
import { PasswordInput } from "@/components/app/password-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api";
import { fieldErrorMap } from "@/lib/api-error";
import { afterLoginPath, loginPath } from "@/lib/return-to";
import type { Role } from "@/lib/session";

type SignupFormProps = {
  returnTo?: string | null;
  /** Client navigation, so the toast survives the page change. */
  navigate: (path: string) => void;
};

type Errors = { message?: string; fields: Record<string, string> };

const LABELS = { name: "Name", email: "Email", password: "Password", acceptTerms: "Terms and privacy" };

/** Reads ?returnTo= from the URL (ACC-10). Render inside <Suspense> so the page stays static. */
export function SignupFormFromUrl() {
  const router = useRouter();
  return <SignupForm returnTo={useSearchParams().get("returnTo")} navigate={(path) => router.push(path)} />;
}

export function SignupForm({ returnTo, navigate }: SignupFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors(null);
    setSubmitting(true);
    let account: { role: Role };
    try {
      await apiFetch("/api/auth/register", { method: "POST", json: { name, email, password, acceptTerms } });
      account = await apiFetch<{ role: Role }>("/api/auth/login", { method: "POST", json: { email, password } });
    } catch (err) {
      setSubmitting(false);
      if (!(err instanceof ApiError)) throw err;
      setErrors({ message: err.message, fields: fieldErrorMap(err.body) });
      return;
    }
    toast.success("Check your email to verify your account");
    navigate(afterLoginPath(account.role, returnTo));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {errors && <FormErrorSummary message={errors.message} errors={errors.fields} labels={LABELS} />}
      <FormField label="Name" name="name" required error={errors?.fields.name}>
        <Input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>
      <FormField label="Email" name="email" required error={errors?.fields.email}>
        <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </FormField>
      <FormField label="Password" name="password" required error={errors?.fields.password}>
        <PasswordInput autoComplete="new-password" showRules value={password} onChange={(e) => setPassword(e.target.value)} />
      </FormField>
      <div className="grid gap-1.5">
        <div className="flex items-start gap-3">
          <Checkbox
            id="field-acceptTerms"
            checked={acceptTerms}
            onCheckedChange={(value) => setAcceptTerms(value === true)}
            aria-invalid={errors?.fields.acceptTerms ? true : undefined}
            aria-describedby={errors?.fields.acceptTerms ? "field-acceptTerms-error" : undefined}
            className="mt-0.5"
          />
          <label htmlFor="field-acceptTerms" className="text-sm">
            I accept the{" "}
            <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-link underline underline-offset-4">
              Terms &amp; Privacy policy<span className="sr-only"> (opens in a new tab)</span>
            </Link>
          </label>
        </div>
        {errors?.fields.acceptTerms && (
          <p id="field-acceptTerms-error" className="text-[13px] text-error">
            {errors.fields.acceptTerms}
          </p>
        )}
      </div>
      <Button type="submit" loading={submitting}>
        Sign up
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={loginPath(returnTo)} className="text-link underline underline-offset-4">
          Log in
        </Link>
      </p>
    </form>
  );
}
