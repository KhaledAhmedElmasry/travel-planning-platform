"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DatePicker } from "@/components/app/date-picker";
import { ErrorState } from "@/components/app/error-state";
import { FormErrorSummary } from "@/components/app/form-error-summary";
import { FormField } from "@/components/app/form-field";
import { MultiSelect, type Option } from "@/components/app/multi-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ApiError, apiFetch } from "@/lib/api";
import { fieldErrorMap } from "@/lib/api-error";

const labels = { title: "Title", countryCodes: "Countries", startDate: "Start date" };

export function CountryLoadError() {
  const router = useRouter();
  return <ErrorState title="Could not load countries" onRetry={() => router.refresh()} />;
}

export function NewItineraryForm({ countries }: { countries: Option[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [countryCodes, setCountryCodes] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>();
  const [visibility, setVisibility] = useState("private");
  const [submitting, setSubmitting] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();

  async function createItinerary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const errors: Record<string, string> = {};
    const trimmedTitle = title.trim();
    if (!trimmedTitle) errors.title = "Enter a title.";
    if (countryCodes.length === 0) errors.countryCodes = "Choose at least one country.";
    if (!startDate) errors.startDate = "Choose a start date.";

    setFields(errors);
    setMessage(undefined);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const itinerary = await apiFetch<{ id: string }>("/api/itineraries", {
        method: "POST",
        json: { title: trimmedTitle, countryCodes, startDate },
      });
      const id = encodeURIComponent(itinerary.id);
      if (visibility === "public") {
        try {
          await apiFetch(`/api/itineraries/${id}`, { method: "PATCH", json: { visibility } });
          toast.success("Public itinerary created");
        } catch (error) {
          const detail = error instanceof ApiError ? error.message : "Try again in the editor.";
          toast.error(`Itinerary created, but publishing failed. ${detail}`);
        }
      } else {
        toast.success("Itinerary created");
      }
      router.replace(`/my/itineraries/${id}`);
    } catch (error) {
      setFields(error instanceof ApiError ? fieldErrorMap(error.body) : {});
      setMessage(error instanceof ApiError ? error.message : "Could not create the itinerary.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={createItinerary} noValidate className="grid gap-4">
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
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Visibility</legend>
        <RadioGroup value={visibility} onValueChange={setVisibility} aria-label="Visibility" disabled={submitting}>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="private" id="new-itinerary-private" />
            <Label htmlFor="new-itinerary-private">Private</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="public" id="new-itinerary-public" />
            <Label htmlFor="new-itinerary-public">Public</Label>
          </div>
        </RadioGroup>
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={submitting}>Create itinerary</Button>
        <Button variant="outline" asChild>
          <Link href="/my/itineraries">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
