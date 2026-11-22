"use client";

// Pick several items from a list with search: countries of an itinerary (ITN-01),
// cities or countries in search filters (ITN-21). Chosen items show as removable chips.
// <FormField label="Countries" name="countries" required error={errors.countries}>
//   <MultiSelect options={countries.map((c) => ({ value: c.code, label: c.name }))}
//                value={codes} onChange={setCodes} placeholder="Add countries" />
// </FormField>
import { useState, type ComponentProps } from "react";
import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { triggerClass } from "@/components/app/date-picker";

export type Option = { value: string; label: string };

type MultiSelectProps = Omit<ComponentProps<"button">, "value" | "onChange"> & {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  /** Most items that can be chosen (the list stops offering more). */
  max?: number;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
};

export function MultiSelect({
  options,
  value,
  onChange,
  max,
  placeholder = "Choose…",
  searchPlaceholder = "Search…",
  emptyText = "No matches.",
  className,
  ...buttonProps
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const chosen = value
    .map((v) => options.find((o) => o.value === v))
    .filter((o): o is Option => Boolean(o));
  const full = max !== undefined && value.length >= max;

  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : full ? value : [...value, v]);

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {/* Radix sets aria-expanded, aria-haspopup and aria-controls on this trigger. */}
          <button type="button" className={triggerClass} {...buttonProps}>
            <span className="truncate text-subtle-foreground">
              {chosen.length === 0 ? placeholder : `${chosen.length} selected${max ? ` (max ${max})` : ""}`}
            </span>
            <ChevronsUpDownIcon className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const selected = value.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      disabled={!selected && full}
                      onSelect={() => toggle(option.value)}
                    >
                      <CheckIcon className={cn("size-4", selected ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                      {option.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Selected">
          {chosen.map((option) => (
            <li key={option.value}>
              <Chip label={option.label} onRemove={() => toggle(option.value)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A removable chip (also used by TagInput). */
export function Chip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-muted pr-1 pl-3 text-sm font-medium">
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
        >
          <XIcon className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
