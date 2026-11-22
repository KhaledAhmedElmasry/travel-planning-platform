"use client";

// A departure or arrival time in the AIRPORT'S local time (FLT-03, FLT-05, GEN-06).
// The value is "YYYY-MM-DDTHH:mm", exactly what POST /api/flights expects in
// departureLocal / arrivalLocal; the backend turns it into UTC with the airport's zone.
// <FormField label="Departure (local time)" name="departureLocal" required error={errors.departureLocal}>
//   <DateTimePicker value={dep} onChange={setDep} airport="CAI" timeZone="Africa/Cairo" min={todayString()} />
// </FormField>
import type { ComponentProps } from "react";
import { GlobeIcon } from "lucide-react";
import { cn } from "cn";
import { DatePicker } from "@/components/app/date-picker";
import { TimeInput } from "@/components/app/time-input";

type DateTimePickerProps = Omit<ComponentProps<"button">, "value" | "onChange"> & {
  /** "2027-03-01T14:30" (local to the airport) */
  value?: string;
  onChange: (value: string | undefined) => void;
  /** IATA code shown in the label, e.g. "CAI" */
  airport?: string;
  /** IANA zone of the airport, e.g. "Africa/Cairo" */
  timeZone?: string;
  min?: string;
  name?: string;
};

export function DateTimePicker({ value, onChange, airport, timeZone, min, name, className, id, ...rest }: DateTimePickerProps) {
  const [date, time] = value ? value.split("T") : [undefined, undefined];
  const update = (nextDate?: string, nextTime?: string) =>
    onChange(nextDate ? `${nextDate}T${nextTime || "00:00"}` : undefined);

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex flex-wrap gap-2">
        <DatePicker
          id={id}
          value={date}
          onChange={(d) => update(d, time)}
          min={min}
          className="min-w-0 flex-1"
          {...rest}
        />
        <TimeInput
          aria-label="Time"
          value={time ?? ""}
          onChange={(e) => update(date, e.target.value)}
          disabled={!date}
        />
      </div>
      {(airport || timeZone) && (
        <p className="flex items-center gap-1.5 text-[13px] text-subtle-foreground">
          <GlobeIcon className="size-3.5" aria-hidden="true" />
          Local time at {airport ?? "the airport"}
          {timeZone && ` (${timeZone})`}
        </p>
      )}
      {name && <input type="hidden" name={name} value={value ?? ""} />}
    </div>
  );
}
