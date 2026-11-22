"use client";

// Check-in and check-out (HTL-11, HTL-16), availability ranges (HTL-04), report and
// booking filters (ACC-17). Values are "YYYY-MM-DD"; the nights count is shown.
// <FormField label="Dates" name="dates" required error={errors.checkIn ?? errors.checkOut}>
//   <DateRangePicker value={{ from: checkIn, to: checkOut }} onChange={(r) => {...}} min={todayString()} />
// </FormField>
// Check-out must be after check-in: picking the same day twice is not accepted as a stay
// when `minNights` is 1 (the default).
import { useState, type ComponentProps } from "react";
import { CalendarRangeIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { cn } from "cn";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { disabledDays, triggerClass } from "@/components/app/date-picker";
import { formatDay, fromDateString, nightsBetween, toDateString } from "@/lib/dates";

export type DateRangeValue = { from?: string; to?: string };

type DateRangePickerProps = Omit<ComponentProps<"button">, "value" | "onChange"> & {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  min?: string;
  max?: string;
  /** 1 for hotel stays (check-out after check-in); 0 allows a one-day range (filters). */
  minNights?: number;
  placeholder?: string;
  /** Show "3 nights" after the dates (hotel stays). */
  showNights?: boolean;
};

export function DateRangePicker({
  value,
  onChange,
  min,
  max,
  minNights = 1,
  placeholder = "Pick dates",
  showNights = true,
  className,
  ...buttonProps
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const range: DateRange | undefined = value.from
    ? { from: fromDateString(value.from), to: fromDateString(value.to) }
    : undefined;
  const minDate = fromDateString(min);
  const maxDate = fromDateString(max);
  const disabled = disabledDays(minDate, maxDate);
  const nights = value.from && value.to ? nightsBetween(value.from, value.to) : 0;

  const label =
    value.from && value.to
      ? `${formatDay(value.from)} – ${formatDay(value.to)}`
      : value.from
        ? `${formatDay(value.from)} – choose the end date`
        : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn(triggerClass, className)} {...buttonProps}>
          <CalendarRangeIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className={cn("truncate", !value.from && "text-subtle-foreground")}>{label}</span>
          {showNights && nights > 0 && (
            <span className="tabular ml-auto shrink-0 text-sm text-muted-foreground">
              {nights} night{nights === 1 ? "" : "s"}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={range}
          defaultMonth={range?.from ?? minDate}
          disabled={disabled}
          min={minNights}
          onSelect={(next) => {
            const from = next?.from ? toDateString(next.from) : undefined;
            const to = next?.to ? toDateString(next.to) : undefined;
            const complete = from && to && nightsBetween(from, to) >= minNights;
            onChange({ from, to: complete ? to : undefined });
            if (complete) setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
