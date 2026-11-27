"use client";

// BudgetRow
// Part: T3 Itinerary editor
// Requirements: ITN-14
// Used by: P-26
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
import { useState } from "react";
import { BudgetAmount } from "@/components/app/budget-amount";
import { FormField } from "@/components/app/form-field";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { DeleteEntry, EditorForm, EditorSelect, type Option } from "./editor-form";

export const budgetCategories = [
  { value: "food", label: "Food" },
  { value: "accommodation", label: "Accommodation" },
  { value: "in_city_transport", label: "In-city transport" },
  { value: "activities", label: "Activities" },
];

export type Budget = { id: string; category: string; amount: number; currency: string; description: string };

export function BudgetRow({ dayPath, entry, currencies }: {
  dayPath: string; entry?: Budget; currencies: Option[];
}) {
  const [category, setCategory] = useState(entry?.category ?? "");
  const [amount, setAmount] = useState(entry?.amount.toString() ?? "");
  const [currency, setCurrency] = useState(entry?.currency ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const path = entry ? `/api/budgets/${entry.id}` : `${dayPath}/budgets`;
  const label = budgetCategories.find((option) => option.value === entry?.category)?.label;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {entry && (
        <p className="me-auto">{label}{entry.description && ` · ${entry.description}`}{" "}
          <BudgetAmount amount={entry.amount} currency={entry.currency} />
        </p>
      )}
      <EditorForm label={entry ? "Edit budget entry" : "Add budget entry"} path={path} method={entry ? "PATCH" : "POST"}
        payload={() => ({ category, amount: Number(amount), currency, description: description.trim() })}>
        {(errors) => (
          <>
            <EditorSelect name="category" label="Category" options={budgetCategories} value={category} onChange={setCategory} error={errors.category} required />
            <FormField name="amount" label="Amount" error={errors.amount} required>
              <Input type="number" min={0} step="any" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </FormField>
            <EditorSelect name="currency" label="Currency" options={currencies} value={currency} onChange={setCurrency} error={errors.currency} required />
            <FormField name="description" label="Description" error={errors.description}>
              <Input maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
            </FormField>
          </>
        )}
      </EditorForm>
      {entry && <DeleteEntry label="Delete budget entry" description="This removes the entry from the day’s budget." remove={() => apiFetch(path, { method: "DELETE" })} />}
    </div>
  );
}
