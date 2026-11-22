"use client";

// <NumberStepper label="Adults" hint="12 years and older" value={adults} min={1} max={9} onChange={setAdults} />
// Passengers (FLT-11: at least 1 adult, infants <= adults), guests and rooms (HTL-11),
// extra bags (FLT-21). The page passes min/max, so rules like "infants <= adults"
// are just max={adults} on the infants stepper.
import { MinusIcon, PlusIcon } from "lucide-react";
import { cn } from "cn";

type NumberStepperProps = {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
};

export function NumberStepper({ label, hint, value, onChange, min = 0, max = 99, className }: NumberStepperProps) {
  const buttonClass =
    "grid size-9 place-items-center rounded-full border border-input bg-background text-foreground transition-colors hover:border-ring disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className={cn("flex items-center justify-between gap-4 py-2", className)} role="group" aria-label={label}>
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-[13px] text-subtle-foreground">{hint}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={buttonClass}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Fewer ${label.toLowerCase()}`}
        >
          <MinusIcon className="size-4" aria-hidden="true" />
        </button>
        <output className="tabular w-6 text-center font-semibold" aria-live="polite">
          {value}
        </output>
        <button
          type="button"
          className={buttonClass}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`More ${label.toLowerCase()}`}
        >
          <PlusIcon className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
