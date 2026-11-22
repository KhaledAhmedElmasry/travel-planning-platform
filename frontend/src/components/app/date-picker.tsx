"use client";

// One calendar day as "YYYY-MM-DD" (itinerary start date ITN-01, departure date FLT-11).
// <FormField label="Departure date" name="date" required error={errors.date}>
//   <DatePicker value={date} onChange={setDate} min={todayString()} />
// </FormField>
// FormField passes id/name/aria props; `name` also fills a hidden input for plain forms.
import { useState, type ComponentProps } from "react";
import { CalendarIcon } from "lucide-react";
import type { Matcher } from "react-day-picker";
import { cn } from "cn";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDay, fromDateString, toDateString } from "@/lib/dates";

type DatePickerProps = Omit<ComponentProps<"button">, "value" | "onChange"> & {
  value?: string;
  onChange: (value: string | undefined) => void;
  /** Earliest allowed day, "YYYY-MM-DD" (e.g. today: no dates in the past). */
  min?: string;
  max?: string;
  placeholder?: string;
  name?: string;
};

/** Days the user can't pick: before `min` and after `max`. */
export function disabledDays(min?: Date, max?: Date): Matcher[] {
  const days: Matcher[] = [];
  if (min) days.push({ before: min });
  if (max) days.push({ after: max });
  return days;
}

export const triggerClass =
  "flex h-11 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 text-left text-base transition-colors duration-150 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 aria-invalid:border-error disabled:cursor-not-allowed disabled:opacity-45";

export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Pick a date",
  name,
  className,
  ...buttonProps
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = fromDateString(value);
  const minDate = fromDateString(min);
  const maxDate = fromDateString(max);
  const disabled = disabledDays(minDate, maxDate);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn(triggerClass, className)} {...buttonProps}>
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className={cn("truncate", !value && "text-subtle-foreground")}>
            {value ? formatDay(value) : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? minDate}
          disabled={disabled}
          onSelect={(day) => {
            onChange(day ? toDateString(day) : undefined);
            setOpen(false);
          }}
        />
      </PopoverContent>
      {name && <input type="hidden" name={name} value={value ?? ""} />}
    </Popover>
  );
}
