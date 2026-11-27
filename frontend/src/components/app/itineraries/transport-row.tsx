"use client";

// TransportRow
// Part: T3 Itinerary editor
// Requirements: ITN-16
// Used by: P-26
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
import { useState } from "react";
import { BudgetAmount } from "@/components/app/budget-amount";
import { FormField } from "@/components/app/form-field";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { DeleteEntry, EditorForm, EditorSelect, type Option } from "./editor-form";

const modes = ["flight", "train", "bus", "car", "ferry", "other"].map((value) => ({
  value, label: value.charAt(0).toUpperCase() + value.slice(1),
}));

export type Transport = { id: string; dayId: string; mode: string; fromCityId: string; toCityId: string; amount: number; currency: string };

export function TransportRow({ itineraryPath, dayId, entry, days, cities, currencies }: {
  itineraryPath: string; dayId: string; entry?: Transport; days: Option[]; cities: Option[]; currencies: Option[];
}) {
  const [day, setDay] = useState(entry?.dayId ?? dayId);
  const [mode, setMode] = useState(entry?.mode ?? "");
  const [fromCityId, setFrom] = useState(entry?.fromCityId ?? "");
  const [toCityId, setTo] = useState(entry?.toCityId ?? "");
  const [amount, setAmount] = useState(entry?.amount.toString() ?? "");
  const [currency, setCurrency] = useState(entry?.currency ?? "");
  const path = entry ? `/api/transport-costs/${entry.id}` : `${itineraryPath}/transport-costs`;
  const cityName = (id: string) => cities.find((city) => city.value === id)?.label ?? id;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {entry && (
        <p className="me-auto">{modes.find((option) => option.value === entry.mode)?.label}{" "}
          {cityName(entry.fromCityId)} to {cityName(entry.toCityId)}{" "}
          <BudgetAmount amount={entry.amount} currency={entry.currency} />
        </p>
      )}
      <EditorForm label={entry ? "Edit transport cost" : "Add transport cost"} path={path} method={entry ? "PATCH" : "POST"}
        payload={() => ({ dayId: day, mode, fromCityId, toCityId, amount: Number(amount), currency })}>
        {(errors) => (
          <>
            <EditorSelect name="dayId" label="Day" options={days} value={day} onChange={setDay} error={errors.dayId} required />
            <EditorSelect name="mode" label="Mode" options={modes} value={mode} onChange={setMode} error={errors.mode} required />
            <EditorSelect name="fromCityId" label="From city" options={cities} value={fromCityId} onChange={setFrom} error={errors.fromCityId} required />
            <EditorSelect name="toCityId" label="To city" options={cities} value={toCityId} onChange={setTo} error={errors.toCityId} required />
            <FormField name="amount" label="Amount" error={errors.amount} required>
              <Input type="number" min={0} step="any" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </FormField>
            <EditorSelect name="currency" label="Currency" options={currencies} value={currency} onChange={setCurrency} error={errors.currency} required />
          </>
        )}
      </EditorForm>
      {entry && <DeleteEntry label="Delete transport cost" description="This removes the transport cost from the itinerary." remove={() => apiFetch(path, { method: "DELETE" })} />}
    </div>
  );
}
