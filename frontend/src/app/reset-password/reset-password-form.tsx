"use client";

// P-10 form (ACC-07). Team leader (24 Nov): new password with the live rules + confirm; the backend
// gives one 400 for an invalid, expired or used link, so that is one state with "Request a new link";
// on success go to /login with a toast (the backend logged the account out everywhere).
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormErrorSummary } from "@/components/app/form-error-summary";
import { FormField } from "@/components/app/form-field";
import { PasswordInput } from "@/components/app/password-input";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api";
import { fieldErrorMap } from "@/lib/api-error";

type ResetPasswordFormProps = {
  token: string | null;
  /** Client navigation, so the toast survives the page change. */
  navigate: (path: string) => void;
};

type Errors = { message?: string; fields: Record<string, string> };

/** Reads ?token= once, then removes it from the address bar. Render inside <Suspense> so the page stays static. */
export function ResetPasswordFormFromUrl() {
  const router = useRouter();
  const params = useSearchParams();
  // Kept in state: after replaceState the URL (and useSearchParams) no longer has it.
  const [token] = useState(() => params.get("token") || null);
  useEffect(() => {
    if (token) window.history.replaceState(null, "", "/reset-password");
  }, [token]);
  return <ResetPasswordForm token={token} navigate={(path) => router.push(path)} />;
}

function NewLinkNeeded({ message }: { message: string }) {
  return (
    <div className="grid gap-4">
      <p role="alert">{message}</p>
      <Button asChild>
        <Link href="/forgot-password">Request a new link</Link>
      </Button>
    </div>
  );
}

export function ResetPasswordForm({ token, navigate }: ResetPasswordFormProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors | null>(null);
  const [linkInvalid, setLinkInvalid] = useState<string | null>(null);

  if (!token) return <NewLinkNeeded message="This reset link is incomplete." />;
  if (linkInvalid) return <NewLinkNeeded message={linkInvalid} />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors(null);
    if (newPassword !== confirm) {
      setErrors({ fields: { confirm: "Passwords do not match" } });
      return;
    }
    setSubmitting(true);
    let result: { message: string };
    try {
      result = await apiFetch<{ message: string }>("/api/auth/reset-password", { method: "POST", json: { token, newPassword } });
    } catch (err) {
      setSubmitting(false);
      if (!(err instanceof ApiError)) throw err;
      const fields = fieldErrorMap(err.body);
      // A 400 without field errors is the token itself (invalid, expired or already used).
      if (err.status === 400 && Object.keys(fields).length === 0) setLinkInvalid(err.message);
      else setErrors({ message: err.message, fields });
      return;
    }
    toast.success(result.message, { description: "You were logged out on all devices." });
    navigate("/login");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {errors && (
        <FormErrorSummary
          message={errors.message}
          errors={errors.fields}
          labels={{ newPassword: "New password", confirm: "Confirm new password" }}
        />
      )}
      <FormField label="New password" name="newPassword" required error={errors?.fields.newPassword}>
        <PasswordInput autoComplete="new-password" showRules value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </FormField>
      <FormField label="Confirm new password" name="confirm" required error={errors?.fields.confirm}>
        <PasswordInput autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </FormField>
      <Button type="submit" loading={submitting}>
        Reset password
      </Button>
    </form>
  );
}
