"use client";

// P-05 profile (ACC-09): email shown, name / phone / preferred currency editable in one form
// (team leader, 23 Nov). The backend saves nothing unless every field is valid; an empty phone
// removes the phone number.
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormErrorSummary } from "@/components/app/form-error-summary";
import { FormField } from "@/components/app/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError, apiFetch } from "@/lib/api";
import { fieldErrorMap } from "@/lib/api-error";

export type Profile = { name: string; email: string; phone: string | null; preferredCurrency: string | null };
export type Currency = { code: string; name: string };

type Errors = { message?: string; fields: Record<string, string> };

const LABELS = { name: "Name", phone: "Phone number", preferredCurrency: "Preferred currency" };

export function ProfileForm({ profile, currencies }: { profile: Profile; currencies: Currency[] }) {
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [currency, setCurrency] = useState(profile.preferredCurrency ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/users/me", {
        method: "PATCH",
        json: { name, phone, ...(currency ? { preferredCurrency: currency } : {}) },
      });
      toast.success("Profile saved");
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      setErrors({ message: err.message, fields: fieldErrorMap(err.body) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {errors && <FormErrorSummary message={errors.message} errors={errors.fields} labels={LABELS} />}
      <div className="grid gap-1.5">
        <p className="text-sm font-medium text-foreground">Email</p>
        <p className="text-muted-foreground">{profile.email}</p>
      </div>
      <FormField label="Name" name="name" required error={errors?.fields.name}>
        <Input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>
      <FormField label="Phone number" name="phone" error={errors?.fields.phone}>
        <Input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </FormField>
      {/* Select outside FormField: FormField labels its direct child, which must be the trigger button. */}
      <Select value={currency} onValueChange={setCurrency}>
        <FormField label="Preferred currency" name="preferredCurrency" error={errors?.fields.preferredCurrency}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a currency" />
          </SelectTrigger>
        </FormField>
        <SelectContent>
            {currencies.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.code} · {c.name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      <Button type="submit" loading={submitting} className="justify-self-start">
        Save
      </Button>
    </form>
  );
}
