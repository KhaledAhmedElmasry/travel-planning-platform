"use client";

// P-09 form (ACC-07). The backend answers the same whether or not the email exists, so we show its
// message as-is (team leader, 24 Nov). "Send again" brings the form back; a newer link replaces the old one.
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { FormErrorSummary } from "@/components/app/form-error-summary";
import { FormField } from "@/components/app/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api";
import { fieldErrorMap } from "@/lib/api-error";

type Errors = { message?: string; fields: Record<string, string> };

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors(null);
    setSubmitting(true);
    try {
      const result = await apiFetch<{ message: string }>("/api/auth/forgot-password", { method: "POST", json: { email } });
      setSent(result.message);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      setErrors({ message: err.message, fields: fieldErrorMap(err.body) });
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="grid gap-4">
        <p role="status">{sent}</p>
        <p className="text-muted-foreground">The link expires after 30 minutes and works once. Check your spam folder too.</p>
        <Button variant="secondary" onClick={() => setSent(null)}>
          Send again or use a different email
        </Button>
        <Link href="/login" className="justify-self-center text-sm text-link underline underline-offset-4">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {errors && <FormErrorSummary message={errors.message} errors={errors.fields} labels={{ email: "Email" }} />}
      <FormField label="Email" name="email" required error={errors?.fields.email}>
        <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </FormField>
      <Button type="submit" loading={submitting}>
        Send reset link
      </Button>
      <Link href="/login" className="justify-self-center text-sm text-link underline underline-offset-4">
        Back to log in
      </Link>
    </form>
  );
}
