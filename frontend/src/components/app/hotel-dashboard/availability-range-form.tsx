"use client";

// Date range of the availability calendar (HTL-08): the moderator picks the first and the last date
// and the page reloads with ?from=&to= in the URL (so back button and shared links keep the range).
// Same day twice is allowed (one day). At most 366 days, like the backend (GEN-02: error under the field).
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DateRangePicker, type DateRangeValue } from "@/components/app/date-range-picker";
import { FormField } from "@/components/app/form-field";
import { MAX_RANGE_DAYS } from "@/components/app/hotel-dashboard/availability-grid";
import { Button } from "@/components/ui/button";
import { nightsBetween } from "@/lib/dates";

export function AvailabilityRangeForm({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const [range, setRange] = useState<DateRangeValue>({ from, to });
  const [error, setError] = useState<string | undefined>();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!range.from || !range.to) {
      setError("Choose the first and the last date.");
      return;
    }
    if (nightsBetween(range.from, range.to) + 1 > MAX_RANGE_DAYS) {
      setError(`Choose at most ${MAX_RANGE_DAYS} days.`);
      return;
    }
    setError(undefined);
    router.push(`/hotel/availability?from=${range.from}&to=${range.to}`);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-wrap items-start gap-3">
      <FormField label="Dates" name="dates" error={error} className="w-full max-w-sm">
        <DateRangePicker value={range} onChange={setRange} minNights={0} showNights={false} />
      </FormField>
      <Button type="submit" className="mt-6">
        Show availability
      </Button>
    </form>
  );
}
