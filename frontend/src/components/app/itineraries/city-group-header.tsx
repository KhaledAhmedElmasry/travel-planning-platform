// CityGroupHeader
// Part: T3 Itinerary editor
// Requirements: ITN-09
// Used by: P-26
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
import { BudgetAmount } from "@/components/app/budget-amount";

export type CityGroup = {
  cityId: string;
  firstDay: number;
  lastDay: number;
  dayCount: number;
  dayIds: string[];
  startDate: string;
  endDate: string;
  budgetSubtotal?: Record<string, number>;
};

export function CityGroupHeader({ name, group }: { name: string; group: CityGroup }) {
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <h2 className="text-lg font-semibold">{name}</h2>
        <p className="text-sm text-muted-foreground">{group.dayCount} {group.dayCount === 1 ? "day" : "days"}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {Object.entries(group.budgetSubtotal ?? {}).map(([currency, amount]) => (
          <BudgetAmount key={currency} amount={amount} currency={currency} />
        ))}
      </div>
    </header>
  );
}
