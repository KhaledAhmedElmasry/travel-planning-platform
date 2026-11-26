// GuestsPerRoom
// Part: T2 Hotels + my posts list
// Requirements: HTL-16
// Used by: P-19
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
"use client";

import { FormField } from "@/components/app/form-field";
import { NumberStepper } from "@/components/app/number-stepper";
import { Input } from "@/components/ui/input";

/** A child with no age entered yet has NaN (P-19 asks for every age, HTL-16 ages 0-17). */
export type RoomGuests = { adults: number; childrenAges: number[] };

type Props = {
  roomNumber: string;
  maxOccupancy: number;
  value: RoomGuests;
  onChange: (value: RoomGuests) => void;
  error?: string;
};

export function GuestsPerRoom({ roomNumber, maxOccupancy, value, onChange, error }: Props) {
  const children = value.childrenAges.length;
  const remaining = maxOccupancy - value.adults - children;
  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4">
      <legend className="px-1 font-semibold">Room {roomNumber}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberStepper label="Adults" value={value.adults} min={0} max={maxOccupancy} onChange={(adults) => onChange({ ...value, adults })} />
        <NumberStepper label="Children" value={children} min={0} max={Math.max(0, maxOccupancy - value.adults)} onChange={(count) => onChange({ ...value, childrenAges: value.childrenAges.slice(0, count).concat(Array.from({ length: Math.max(0, count - value.childrenAges.length) }, () => Number.NaN)) })} />
      </div>
      {children > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {value.childrenAges.map((age, index) => (
            <FormField key={index} label={`Child ${index + 1} age`} name={`child-${roomNumber}-${index}`} required>
              <Input type="number" min={0} max={17} value={Number.isNaN(age) ? "" : age} onChange={(event) => onChange({ ...value, childrenAges: value.childrenAges.map((current, childIndex) => childIndex === index ? (event.target.value === "" ? Number.NaN : Number(event.target.value)) : current) })} />
            </FormField>
          ))}
        </div>
      )}
      <p className={error ? "text-sm text-error" : "text-sm text-muted-foreground"} role={error ? "alert" : undefined}>
        {error ?? `${remaining} place${remaining === 1 ? "" : "s"} remaining · children must be ages 0–17`}
      </p>
    </fieldset>
  );
}
