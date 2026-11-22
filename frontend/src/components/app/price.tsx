// <Price cents={12000} currency="USD" /> -> "$120.00 USD" (PAY-04).
// Booking prices, payments and refunds come from the backend in integer cents of
// the platform currency. Never format cents by hand; never convert them.
import { cn } from "cn";
import { formatCents } from "@/lib/format";

type PriceProps = {
  cents: number;
  currency: string;
  /** sm = in a sentence or table, md = cards, lg = totals */
  size?: "sm" | "md" | "lg";
  /** Hide the trailing "USD" code (only where the code is already shown nearby). */
  hideCode?: boolean;
  className?: string;
};

const sizes = {
  sm: "text-sm font-medium",
  md: "text-lg font-semibold",
  lg: "text-2xl font-bold",
};

export function Price({ cents, currency, size = "md", hideCode = false, className }: PriceProps) {
  return (
    <span className={cn("tabular whitespace-nowrap text-foreground", sizes[size], className)}>
      {formatCents(cents, currency)}
      {!hideCode && (
        <span className="ml-1 text-xs font-medium text-subtle-foreground">{currency}</span>
      )}
    </span>
  );
}
