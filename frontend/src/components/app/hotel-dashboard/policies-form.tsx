"use client";

// Hotel policies form (P-46: HTL-09 check-in / check-out times, HTL-10 cancellation tiers).
// PUT /api/hotels/{id}/policies replaces all three values at once. Tiers use the kit TiersEditor (days before check-in,
// unique, refund 0-100%). Errors: under each field and under each tier row (GEN-02), checked here first with
// validateTiers() and then mapped from the backend's fieldErrors ("cancellationTiers.0.daysBefore" -> row 0).
// "Discard changes" goes back to the last saved values without leaving the page (GEN-14).
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormErrorSummary } from "@/components/app/form-error-summary";
import { FormField } from "@/components/app/form-field";
import { TimeInput } from "@/components/app/time-input";
import { TiersEditor, validateTiers, type Tier } from "@/components/app/tiers-editor";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api";
import { fieldErrorMap } from "@/lib/api-error";

/** The policy part of GET /api/hotels/{id} (openapi HotelPoliciesResponse fields). */
export type HotelPolicies = {
  checkInTime: string;
  checkOutTime: string;
  cancellationTiers: { daysBefore: number; refundPercentage: number }[];
};

type Values = { checkInTime: string; checkOutTime: string; tiers: Tier[] };
type Errors = { message?: string; fields: Record<string, string>; rows: Record<number, string> };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const LABELS = { checkInTime: "Check-in time", checkOutTime: "Check-out time" };

/** Backend field names -> page fields, and "cancellationTiers.N.x" -> tier row N. */
function mapBackendErrors(fields: Record<string, string>) {
  const top: Record<string, string> = {};
  const rows: Record<number, string> = {};
  for (const [field, message] of Object.entries(fields)) {
    const row = /^cancellationTiers\.(\d+)/.exec(field);
    if (row) rows[Number(row[1])] = message;
    else top[field] = message;
  }
  return { top, rows };
}

export function PoliciesForm({ hotelId, initial }: { hotelId: string; initial: HotelPolicies }) {
  const router = useRouter();
  const [saved, setSaved] = useState<Values>({
    checkInTime: initial.checkInTime,
    checkOutTime: initial.checkOutTime,
    tiers: initial.cancellationTiers.map((tier) => ({ ...tier })),
  });
  const [checkInTime, setCheckInTime] = useState(saved.checkInTime);
  const [checkOutTime, setCheckOutTime] = useState(saved.checkOutTime);
  const [tiers, setTiers] = useState<Tier[]>(saved.tiers);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors | null>(null);

  const dirty = JSON.stringify({ checkInTime, checkOutTime, tiers }) !== JSON.stringify(saved);

  function discard() {
    setCheckInTime(saved.checkInTime);
    setCheckOutTime(saved.checkOutTime);
    setTiers(saved.tiers);
    setErrors(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const fields: Record<string, string> = {};
    if (!TIME.test(checkInTime)) fields.checkInTime = "Enter the check-in time, for example 14:00.";
    if (!TIME.test(checkOutTime)) fields.checkOutTime = "Enter the check-out time, for example 12:00.";
    const rows = validateTiers(tiers);
    if (Object.keys(fields).length > 0 || Object.keys(rows).length > 0) {
      setErrors({ fields, rows });
      return;
    }

    setErrors(null);
    setSubmitting(true);
    const cancellationTiers = tiers.map((tier) => ({
      daysBefore: Number(tier.daysBefore),
      refundPercentage: Number(tier.refundPercentage),
    }));
    try {
      await apiFetch(`/api/hotels/${encodeURIComponent(hotelId)}/policies`, {
        method: "PUT",
        json: { checkInTime, checkOutTime, cancellationTiers },
      });
      setSaved({ checkInTime, checkOutTime, tiers: cancellationTiers });
      toast.success("Policies saved");
      router.refresh();
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      const { top, rows: backendRows } = mapBackendErrors(fieldErrorMap(err.body));
      setErrors({ message: err.message, fields: top, rows: backendRows });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-2xl gap-8">
      {errors && <FormErrorSummary message={errors.message} errors={errors.fields} labels={LABELS} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Check-in time" name="checkInTime" required error={errors?.fields.checkInTime}>
          <TimeInput value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} />
        </FormField>
        <FormField label="Check-out time" name="checkOutTime" required error={errors?.fields.checkOutTime}>
          <TimeInput value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} />
        </FormField>
      </div>
      <fieldset className="grid gap-3">
        <legend className="mb-1 text-lg font-semibold">Cancellation tiers</legend>
        <TiersEditor value={tiers} onChange={setTiers} unit="check-in" errors={errors?.rows} />
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={submitting}>
          Save policies
        </Button>
        <Button type="button" variant="ghost" onClick={discard} disabled={!dirty || submitting}>
          Discard changes
        </Button>
      </div>
    </form>
  );
}
