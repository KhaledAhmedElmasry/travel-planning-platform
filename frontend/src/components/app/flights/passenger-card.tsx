// <PassengerCard index={0} value={passenger} onChange={...} errors={errors} baggage={baggage} />
// PassengerCard
// Part: T1 Flights + itinerary list
// Requirements: FLT-19, FLT-12, FLT-08
// Used by: P-14
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Built from kit parts (design-system/yallaway/MASTER.md 6.2).
// One passenger's details (FLT-19): full name, date of birth, passport or ID number, and optional extra
// bags with their weights (FLT-08). The type (adult 12+, child 2-11, infant under 2 on the departure
// date, FLT-12) is fixed by the passenger counts; the date of birth must match it. Errors use the
// backend's field names (passengers.<index>.<field>), so frontend checks and fieldErrors share one map.
"use client";

import { FormField } from "@/components/app/form-field";
import { NumberStepper } from "@/components/app/number-stepper";
import { Price } from "@/components/app/price";
import { Input } from "@/components/ui/input";

export type PassengerType = "adult" | "child" | "infant";

/** A bag with no weight entered yet has NaN. */
export type PassengerInput = {
  type: PassengerType;
  fullName: string;
  dateOfBirth: string;
  passportNumber: string;
  extraBags: number[];
};

/** The extra-baggage rules of the booking (FLT-08): the strictest of the booked flights. */
export type BaggageRules = { extraBagPrice: number; maxExtraBags: number; maxBagWeightKg: number; currency: string };

export const PASSENGER_LABEL: Record<PassengerType, string> = { adult: "Adult", child: "Child", infant: "Infant" };
const AGE_HINT: Record<PassengerType, string> = {
  adult: "12 or older on the departure date",
  child: "2 to 11 on the departure date",
  infant: "Under 2 on the departure date",
};

type PassengerCardProps = {
  index: number;
  /** Number shown in the title among passengers of the same type, e.g. "Child 2". */
  number: number;
  value: PassengerInput;
  onChange: (value: PassengerInput) => void;
  /** Keyed by the backend's field names, e.g. "passengers.0.fullName". */
  errors: Record<string, string>;
  baggage: BaggageRules;
  /** YYYY-MM-DD of the departure: the latest possible date of birth. */
  departureDate: string;
};

export function PassengerCard({ index, number, value, onChange, errors, baggage, departureDate }: PassengerCardProps) {
  const key = (field: string) => `passengers.${index}.${field}`;
  const set = (patch: Partial<PassengerInput>) => onChange({ ...value, ...patch });
  const bags = value.extraBags;

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4">
      <legend className="px-1 font-semibold">
        {PASSENGER_LABEL[value.type]} {number}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Full name" name={key("fullName")} required error={errors[key("fullName")]} hint="As on the passport or ID">
          <Input autoComplete="name" maxLength={100} value={value.fullName} onChange={(e) => set({ fullName: e.target.value })} />
        </FormField>
        <FormField label="Date of birth" name={key("dateOfBirth")} required error={errors[key("dateOfBirth")]} hint={AGE_HINT[value.type]}>
          <Input type="date" max={departureDate} value={value.dateOfBirth} onChange={(e) => set({ dateOfBirth: e.target.value })} />
        </FormField>
        <FormField label="Passport or ID number" name={key("passportNumber")} required error={errors[key("passportNumber")]}>
          <Input maxLength={20} autoComplete="off" value={value.passportNumber} onChange={(e) => set({ passportNumber: e.target.value })} />
        </FormField>
        {baggage.maxExtraBags > 0 && (
          <NumberStepper
            label="Extra bags"
            hint={`${baggage.maxExtraBags} at most`}
            value={bags.length}
            min={0}
            max={baggage.maxExtraBags}
            onChange={(count) =>
              set({ extraBags: bags.slice(0, count).concat(Array.from({ length: Math.max(0, count - bags.length) }, () => Number.NaN)) })
            }
          />
        )}
      </div>
      {bags.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {bags.map((weight, bag) => (
            <FormField
              key={bag}
              label={`Bag ${bag + 1} weight (kg)`}
              name={key(`extraBags.${bag}.weightKg`)}
              required
              error={errors[key(`extraBags.${bag}.weightKg`)]}
              hint={`Up to ${baggage.maxBagWeightKg} kg`}
            >
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={baggage.maxBagWeightKg}
                step="0.1"
                value={Number.isNaN(weight) ? "" : weight}
                onChange={(e) =>
                  set({ extraBags: bags.map((w, i) => (i === bag ? (e.target.value === "" ? Number.NaN : Number(e.target.value)) : w)) })
                }
              />
            </FormField>
          ))}
          <p className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground sm:col-span-2">
            {bags.length} × <Price cents={baggage.extraBagPrice} currency={baggage.currency} size="sm" hideCode /> ={" "}
            <Price cents={bags.length * baggage.extraBagPrice} currency={baggage.currency} size="sm" />
          </p>
        </div>
      )}
    </fieldset>
  );
}

/** Full years between the date of birth and the departure date (both YYYY-MM-DD). */
export function ageOn(dateOfBirth: string, departureDate: string): number {
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  const [dy, dm, dd] = departureDate.split("-").map(Number);
  return dy - by - (dm < bm || (dm === bm && dd < bd) ? 1 : 0);
}

/**
 * The same rules the backend checks (FLT-19, FLT-12, FLT-08), as { "passengers.0.fullName": "..." }.
 * Empty when everything is fine.
 */
export function passengerErrors(passengers: PassengerInput[], baggage: BaggageRules, departureDate: string): Record<string, string> {
  const errors: Record<string, string> = {};
  passengers.forEach((p, i) => {
    const key = (field: string) => `passengers.${i}.${field}`;
    if (!p.fullName.trim()) errors[key("fullName")] = "Enter the full name.";
    if (!p.passportNumber.trim()) errors[key("passportNumber")] = "Enter the passport or ID number.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.dateOfBirth)) {
      errors[key("dateOfBirth")] = "Enter the date of birth.";
    } else if (p.dateOfBirth > departureDate) {
      errors[key("dateOfBirth")] = "The date of birth cannot be after the departure date.";
    } else {
      const age = ageOn(p.dateOfBirth, departureDate);
      const fits = p.type === "adult" ? age >= 12 : p.type === "child" ? age >= 2 && age <= 11 : age < 2;
      if (!fits) errors[key("dateOfBirth")] = `${PASSENGER_LABEL[p.type]}s must be ${AGE_HINT[p.type].toLowerCase()}.`;
    }
    p.extraBags.forEach((w, bag) => {
      if (!Number.isFinite(w) || w <= 0) errors[key(`extraBags.${bag}.weightKg`)] = "Enter the bag's weight.";
      else if (w > baggage.maxBagWeightKg) errors[key(`extraBags.${bag}.weightKg`)] = `At most ${baggage.maxBagWeightKg} kg.`;
    });
  });
  return errors;
}
