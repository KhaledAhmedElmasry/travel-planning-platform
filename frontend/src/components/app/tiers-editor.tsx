"use client";

// Cancellation tiers for airlines (FLT-09) and hotels (HTL-10).
// Each tier: days before departure / check-in (integer >= 0, unique) and the refund
// percentage (0-100). Matches the backend's CancellationTier { daysBefore, refundPercentage }.
// <TiersEditor value={tiers} onChange={setTiers} unit="departure" />
// validateTiers(tiers) gives per-row messages to show before saving; the backend
// checks the same rules (PUT /api/airlines/:id/cancellation-policy, PUT /api/hotels/:id/policies).
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type Tier = { daysBefore: number | ""; refundPercentage: number | "" };

/** Returns { rowIndex: message } for rows that break a rule; {} when all rows are valid. */
export function validateTiers(tiers: Tier[]): Record<number, string> {
  const errors: Record<number, string> = {};
  const seen = new Map<number, number>();
  tiers.forEach((tier, i) => {
    const days = tier.daysBefore;
    const pct = tier.refundPercentage;
    if (days === "" || !Number.isInteger(days) || days < 0) errors[i] = "Days must be a whole number, 0 or more.";
    else if (pct === "" || pct < 0 || pct > 100) errors[i] = "Refund must be between 0 and 100%.";
    else if (seen.has(days)) errors[i] = `Another tier already uses ${days} days.`;
    if (typeof days === "number") seen.set(days, i);
  });
  return errors;
}

type TiersEditorProps = {
  value: Tier[];
  onChange: (tiers: Tier[]) => void;
  /** Words used in the labels: days before "departure" (flights) or "check-in" (hotels). */
  unit: "departure" | "check-in";
  /** Messages per row, e.g. from validateTiers() or mapped from the backend's fieldErrors. */
  errors?: Record<number, string>;
};

export function TiersEditor({ value, onChange, unit, errors = {} }: TiersEditorProps) {
  const update = (i: number, patch: Partial<Tier>) =>
    onChange(value.map((tier, j) => (j === i ? { ...tier, ...patch } : tier)));
  const parse = (raw: string) => (raw === "" ? "" : Number(raw));
  // Show the tiers sorted the way the rule reads them: most days first.
  const order = value.map((_, i) => i).sort((a, b) => Number(value[b].daysBefore || 0) - Number(value[a].daysBefore || 0));

  return (
    <div className="grid gap-3">
      <p className="text-[13px] text-subtle-foreground">
        The tier with the highest number of days that is still within the days left before {unit} applies.
        With no matching tier, the refund is 0%.
      </p>
      {value.length === 0 && <p className="text-sm text-muted-foreground">No tiers yet: every cancellation would get 0%.</p>}
      <ul className="grid gap-2">
        {order.map((i) => {
          const tier = value[i];
          const daysId = `tier-${i}-days`;
          const pctId = `tier-${i}-pct`;
          const errId = errors[i] ? `tier-${i}-error` : undefined;
          return (
            <li key={i} className="grid gap-1 rounded-lg border border-border bg-background p-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="grid gap-1">
                  <label htmlFor={daysId} className="text-[13px] font-medium">
                    Days before {unit}
                  </label>
                  <Input
                    id={daysId}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={tier.daysBefore}
                    onChange={(e) => update(i, { daysBefore: parse(e.target.value) })}
                    aria-invalid={errors[i] ? true : undefined}
                    aria-describedby={errId}
                    className="tabular w-28"
                  />
                </div>
                <div className="grid gap-1">
                  <label htmlFor={pctId} className="text-[13px] font-medium">
                    Refund %
                  </label>
                  <Input
                    id={pctId}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    value={tier.refundPercentage}
                    onChange={(e) => update(i, { refundPercentage: parse(e.target.value) })}
                    aria-invalid={errors[i] ? true : undefined}
                    aria-describedby={errId}
                    className="tabular w-24"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove tier ${tier.daysBefore === "" ? "" : `${tier.daysBefore} days`}`.trim()}
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                  className="ml-auto"
                >
                  <Trash2Icon />
                </Button>
              </div>
              {errors[i] && (
                <p id={errId} className="text-[13px] text-error">
                  {errors[i]}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        variant="secondary"
        className="w-fit"
        onClick={() => onChange([...value, { daysBefore: "", refundPercentage: "" }])}
      >
        <PlusIcon /> Add tier
      </Button>
    </div>
  );
}
