"use client";

// BudgetSummary
// Part: T3 Itinerary editor
// Requirements: ITN-14, ITN-18
// Used by: P-26
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
import { BarChart } from "@/components/app/bar-chart";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BudgetAmount } from "@/components/app/budget-amount";
import { EmptyState } from "@/components/app/empty-state";
import { Price } from "@/components/app/price";
import { formatDay } from "@/lib/dates";
import { formatAmount } from "@/lib/format";
import { budgetCategories } from "./budget-row";
import { EditorSelect, InlinePages, type Option } from "./editor-form";

export function BudgetCurrency({ currencies, value }: { currencies: Option[]; value?: string }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  return (
    <EditorSelect name="budgetCurrency" label="Budget currency" value={value ?? "preferred"}
      options={[{ value: "preferred", label: "Preferred currency" }, ...currencies]}
      onChange={(currency) => {
        const query = new URLSearchParams(params.toString());
        if (currency === "preferred") query.delete("currency");
        else query.set("currency", currency);
        router.replace(query.size ? `${path}?${query}` : path, { scroll: false });
      }} />
  );
}

type Totals = Record<string, number>;
type Breakdown = {
  totalsByCategory: Record<string, Totals>;
  totalsByDay: { dayId: string; dayNumber: number; date: string; totals: Totals }[];
  intercityTransport: Totals;
  grandTotal: Totals;
};

export type Summary = Breakdown & {
  convertedTotal: (Breakdown & { currency: string; rateDate: string; ratesNotice: string | null }) | null;
  linkedBookings?: { total: Totals };
  grandTotalWithBookings?: Totals;
};

function TotalsRow({ name, totals, bookingPrice = false }: {
  name: string; totals: Totals; bookingPrice?: boolean;
}) {
  if (!Object.keys(totals).length) return null;
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt>{name}</dt>
      <dd className="flex flex-wrap gap-3">
        {Object.entries(totals).map(([currency, amount]) => bookingPrice
          ? <Price key={currency} cents={Math.round(amount * 100)} currency={currency} />
          : <BudgetAmount key={currency} amount={amount} currency={currency} />)}
      </dd>
    </div>
  );
}

function BudgetBreakdown({ data }: { data: Breakdown }) {
  return (
    <div className="grid gap-3">
      <dl className="grid gap-2">
        {budgetCategories.map(({ value, label }) => (
          <TotalsRow key={value} name={label} totals={data.totalsByCategory[value] ?? {}} />
        ))}
        <TotalsRow name="Intercity transport" totals={data.intercityTransport} />
        <TotalsRow name="Total" totals={data.grandTotal} />
      </dl>
      <h4 className="font-semibold">By day</h4>
      <div className="grid gap-2">
        <InlinePages items={data.totalsByDay.filter((day) => Object.keys(day.totals).length > 0).map((day) => (
          <dl key={day.dayId}><TotalsRow name={`Day ${day.dayNumber} · ${formatDay(day.date)}`} totals={day.totals} /></dl>
        ))} />
      </div>
    </div>
  );
}

export function BudgetSummary({ summary }: { summary: Summary }) {
  const converted = summary.convertedTotal;
  const chartCurrencies = converted ? [converted.currency] : Object.keys(summary.grandTotal);
  const chartTotals = (converted ?? summary).totalsByCategory;

  return (
    <section className="grid gap-4">
      <h2 className="text-lg font-semibold">Budget summary</h2>
      {Object.keys(summary.grandTotal).length > 0 ? (
        <>
          <BudgetBreakdown data={summary} />
          {converted && (
            <div className="grid gap-2">
              <h3 className="font-semibold">Converted to {converted.currency}</h3>
              <p className="text-sm text-muted-foreground">Exchange rates from {formatDay(converted.rateDate)}</p>
              {converted.ratesNotice && <p role="status">{converted.ratesNotice}</p>}
              <BudgetBreakdown data={converted} />
            </div>
          )}
          {chartCurrencies.map((currency) => (
            <BarChart key={currency}
              title={`Budget by category (${currency})`}
              format={(amount) => formatAmount(amount, currency)}
              data={budgetCategories.map(({ value, label }) => ({ label, value: chartTotals[value]?.[currency] ?? 0 }))}
            />
          ))}
        </>
      ) : <EmptyState title="No budget totals yet" compact />}
      <dl className="grid gap-2">
        {summary.linkedBookings && <TotalsRow name="Linked bookings" totals={summary.linkedBookings.total} bookingPrice />}
        {summary.grandTotalWithBookings && <TotalsRow name="Total including bookings" totals={summary.grandTotalWithBookings} />}
      </dl>
    </section>
  );
}
