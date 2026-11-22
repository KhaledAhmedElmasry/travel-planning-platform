// <BudgetAmount amount={1234.5} currency="EGP" /> -> "EGP 1,234.50" (ITN-14, ITN-18).
// Itinerary budgets are decimals (not cents) and are the only amounts that can be
// converted to the user's preferred currency. Booking prices use <Price>.
import { cn } from "cn";
import { formatAmount } from "@/lib/format";

type BudgetAmountProps = {
  amount: number;
  currency: string;
  className?: string;
};

export function BudgetAmount({ amount, currency, className }: BudgetAmountProps) {
  return (
    <span className={cn("tabular whitespace-nowrap font-medium", className)}>
      {formatAmount(amount, currency)}
    </span>
  );
}
