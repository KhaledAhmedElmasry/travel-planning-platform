"use client";

// P-03 / P-04 form (ACC-08; forced after a temporary password: ACC-07a, ACC-13).
import { useState, type FormEvent } from "react";
import { FormErrorSummary } from "@/components/app/form-error-summary";
import { FormField } from "@/components/app/form-field";
import { PasswordInput } from "@/components/app/password-input";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api";
import { fieldErrorMap } from "@/lib/api-error";
import { afterLoginPath } from "@/lib/return-to";
import type { Role } from "@/lib/session";

type PasswordFormProps = {
  /** true while the account still has a temporary password. */
  forced: boolean;
  role: Role;
  returnTo?: string | null;
  /** Full page load by default, so server components see the cleared flag. */
  navigate?: (path: string) => void;
};

type Errors = { message?: string; fields: Record<string, string> };

export function PasswordForm({ forced, role, returnTo, navigate = (path) => window.location.assign(path) }: PasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const currentLabel = forced ? "Temporary password" : "Current password";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors(null);
    setSuccess(null);
    if (newPassword !== confirm) {
      setErrors({ fields: { confirm: "Passwords do not match" } });
      return;
    }
    setSubmitting(true);
    let result: { message: string };
    try {
      result = await apiFetch<{ message: string }>("/api/auth/change-password", {
        method: "PATCH",
        json: { currentPassword, newPassword },
      });
    } catch (err) {
      setSubmitting(false);
      if (!(err instanceof ApiError)) throw err;
      setErrors({ message: err.message, fields: fieldErrorMap(err.body) });
      return;
    }
    if (forced) {
      // The temporary password is gone: continue to the pending action or the role home (ACC-10, ACC-04).
      navigate(afterLoginPath(role, returnTo));
      return;
    }
    setSubmitting(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
    setSuccess(result.message);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {errors && (
        <FormErrorSummary
          message={errors.message}
          errors={errors.fields}
          labels={{ currentPassword: currentLabel, newPassword: "New password", confirm: "Confirm new password" }}
        />
      )}
      {success && (
        <p role="status" className="rounded-lg border border-success/50 bg-success/10 p-4 font-semibold text-success">
          {success}
        </p>
      )}
      <FormField label={currentLabel} name="currentPassword" required error={errors?.fields.currentPassword}>
        <PasswordInput autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      </FormField>
      <FormField label="New password" name="newPassword" required error={errors?.fields.newPassword}>
        <PasswordInput autoComplete="new-password" showRules value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </FormField>
      <FormField label="Confirm new password" name="confirm" required error={errors?.fields.confirm}>
        <PasswordInput autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </FormField>
      <Button type="submit" loading={submitting}>
        Change password
      </Button>
    </form>
  );
}
