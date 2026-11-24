"use client";

// SortSelect
// Part: Lead (foundation)
// Requirements: FLT-15, HTL-12
// Used by: P-12, P-15
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
//
// <SortSelect kind="flights" value={{ sortBy, sortOrder }} onChange={(sort) => ...} />
// Team leader (23 Nov): one select with the direction in the label. Values are the openapi
// sortBy (FlightSortBy / HotelSortBy) and sortOrder (asc / desc) query params.
import { FormField } from "@/components/app/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SortOrder = "asc" | "desc";
export type SortValue = { sortBy: string; sortOrder: SortOrder };

const OPTIONS: Record<"flights" | "hotels", { label: string; value: SortValue }[]> = {
  flights: [
    { label: "Price: low to high", value: { sortBy: "price", sortOrder: "asc" } },
    { label: "Price: high to low", value: { sortBy: "price", sortOrder: "desc" } },
    { label: "Duration: shortest", value: { sortBy: "duration", sortOrder: "asc" } },
    { label: "Duration: longest", value: { sortBy: "duration", sortOrder: "desc" } },
    { label: "Departure: earliest", value: { sortBy: "departure_time", sortOrder: "asc" } },
    { label: "Departure: latest", value: { sortBy: "departure_time", sortOrder: "desc" } },
  ],
  hotels: [
    { label: "Price: low to high", value: { sortBy: "price", sortOrder: "asc" } },
    { label: "Price: high to low", value: { sortBy: "price", sortOrder: "desc" } },
    { label: "Rating: highest", value: { sortBy: "rating", sortOrder: "desc" } },
    { label: "Rating: lowest", value: { sortBy: "rating", sortOrder: "asc" } },
  ],
};

const key = (v: SortValue) => `${v.sortBy}:${v.sortOrder}`;

type Props = {
  kind: "flights" | "hotels";
  value: SortValue;
  onChange: (value: SortValue) => void;
};

export function SortSelect({ kind, value, onChange }: Props) {
  const options = OPTIONS[kind];
  return (
    <Select
      value={key(value)}
      onValueChange={(k) => {
        const chosen = options.find((o) => key(o.value) === k);
        if (chosen) onChange(chosen.value);
      }}
    >
      {/* Select outside FormField: FormField labels its direct child, the trigger button. */}
      <FormField label="Sort by" name="sort">
        <SelectTrigger className="w-full sm:w-56">
          <SelectValue />
        </SelectTrigger>
      </FormField>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={key(o.value)} value={key(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
