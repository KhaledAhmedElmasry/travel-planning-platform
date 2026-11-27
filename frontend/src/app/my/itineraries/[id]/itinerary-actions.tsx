"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DatePicker } from "@/components/app/date-picker";
import { ErrorState } from "@/components/app/error-state";
import { FormErrorSummary } from "@/components/app/form-error-summary";
import { FormField } from "@/components/app/form-field";
import { MultiSelect, type Option } from "@/components/app/multi-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError, apiFetch } from "@/lib/api";
import { fieldErrorMap } from "@/lib/api-error";

type Visibility = "private" | "public";
export type Itinerary = { id: string; title: string; countryCodes: string[]; startDate: string; visibility: Visibility };
const labels = { title: "Title", countryCodes: "Countries", startDate: "Start date", visibility: "Visibility" };

export function ItineraryLoadError({ title = "Could not load the itinerary" }: { title?: string }) {
  const router = useRouter();
  return <ErrorState title={title} onRetry={() => router.refresh()} />;
}

export function ItineraryActions({ itinerary, countries }: { itinerary: Itinerary; countries: Option[] }) {
  const router = useRouter();
  const path = `/api/itineraries/${encodeURIComponent(itinerary.id)}`;
  const [title, setTitle] = useState(itinerary.title);
  const [countryCodes, setCountryCodes] = useState(itinerary.countryCodes);
  const [startDate, setStartDate] = useState<string | undefined>(itinerary.startDate);
  const [visibility, setVisibility] = useState(itinerary.visibility);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const errors: Record<string, string> = {};
    const trimmedTitle = title.trim();
    if (!trimmedTitle) errors.title = "Enter a title.";
    if (!countryCodes.length) errors.countryCodes = "Choose at least one country.";
    if (!startDate) errors.startDate = "Choose a start date.";
    setFields(errors);
    setMessage(undefined);
    if (Object.keys(errors).length) return;

    setSaving(true);
    try {
      const updated = await apiFetch<Itinerary>(path, {
        method: "PATCH",
        json: { title: trimmedTitle, countryCodes, startDate, visibility },
      });
      setTitle(updated.title);
      setCountryCodes(updated.countryCodes);
      setStartDate(updated.startDate);
      setVisibility(updated.visibility);
      router.refresh();
      toast.success("Itinerary saved");
    } catch (error) {
      setFields(error instanceof ApiError ? fieldErrorMap(error.body) : {});
      setMessage(error instanceof ApiError ? error.message : "Could not save the itinerary.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await apiFetch(path, { method: "DELETE" });
      toast.success("Itinerary deleted");
      router.replace("/my/itineraries");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not delete the itinerary.");
      throw error;
    }
  }

  return (
    <div className="grid max-w-xl gap-4">
      <form onSubmit={save} noValidate className="grid gap-4">
        <FormErrorSummary errors={fields} labels={labels} message={message} />
        <FormField label={labels.title} name="title" required error={fields.title}>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} />
        </FormField>
        <FormField label={labels.countryCodes} name="countryCodes" required error={fields.countryCodes}>
          <MultiSelect options={countries} value={countryCodes} onChange={setCountryCodes} placeholder="Add countries" />
        </FormField>
        <FormField label={labels.startDate} name="startDate" required error={fields.startDate}>
          <DatePicker value={startDate} onChange={setStartDate} />
        </FormField>
        <Select value={visibility} onValueChange={(value) => {
          if (value === "private" || value === "public") setVisibility(value);
        }}>
          <FormField label={labels.visibility} name="visibility" error={fields.visibility}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          </FormField>
          <SelectContent>
            <SelectItem value="private">Private</SelectItem>
            <SelectItem value="public">Public</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" loading={saving} className="justify-self-start">Save itinerary</Button>
      </form>
      <div>
        <ConfirmDialog
          trigger={<Button variant="destructive" disabled={saving}>Delete itinerary</Button>}
          title="Delete this itinerary?"
          description="This permanently deletes your itinerary and removes it from public search."
          confirmLabel="Delete itinerary"
          onConfirm={remove}
        />
      </div>
    </div>
  );
}
