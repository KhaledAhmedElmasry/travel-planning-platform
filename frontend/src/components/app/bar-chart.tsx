"use client";

// Horizontal bars for comparing amounts across a few categories: budget by category
// (ITN-14), bookings or revenue per provider (BON-01). Khaled's choice: bars everywhere.
// <BarChart
//   title="Budget by category"
//   data={[{ label: "Food", value: 120 }, { label: "Accommodation", value: 640 }]}
//   format={(v) => formatAmount(v, "EUR")}
// />
// One series, one color (--chart-1), so no legend: the title names it. Values sit at the
// end of each bar in text colors; hover or keyboard focus shows the share of the total.
// "Show as table" gives the same numbers as a table (screen readers, print).
// For several series or a trend over time, ask the team leader first (the dataviz rules
// in MASTER.md section 2 apply: palette order, one axis, a legend for 2+ series).
import { useId, useState } from "react";
import { cn } from "cn";

export type BarDatum = { label: string; value: number };

type BarChartProps = {
  title: string;
  /** One sentence with the main point, read by screen readers and shown under the title. */
  summary?: string;
  data: BarDatum[];
  /** How values are written, e.g. (v) => formatAmount(v, "EUR"). */
  format?: (value: number) => string;
  /** Keep the given order (e.g. days) instead of sorting largest first. */
  keepOrder?: boolean;
  className?: string;
};

export function BarChart({ title, summary, data, format = (v) => v.toLocaleString("en-US"), keepOrder = false, className }: BarChartProps) {
  const [asTable, setAsTable] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const rows = keepOrder ? data : [...data].sort((a, b) => b.value - a.value);
  const max = Math.max(0, ...rows.map((d) => d.value));
  const total = rows.reduce((sum, d) => sum + d.value, 0);
  const share = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

  return (
    <figure className={cn("grid gap-4 rounded-xl border border-border bg-card p-5", className)} aria-labelledby={titleId}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <figcaption id={titleId} className="font-semibold">
            {title}
          </figcaption>
          {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
        </div>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
          className="rounded-md px-2 py-1 text-sm font-medium text-link hover:underline"
        >
          {asTable ? "Show as chart" : "Show as table"}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No data yet.</p>
      ) : asTable ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold tracking-wide text-subtle-foreground uppercase">
              <th scope="col" className="py-2">Item</th>
              <th scope="col" className="py-2 text-right">Amount</th>
              <th scope="col" className="py-2 text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.label} className="border-t border-border">
                <td className="py-2">{d.label}</td>
                <td className="tabular py-2 text-right">{format(d.value)}</td>
                <td className="tabular py-2 text-right text-muted-foreground">{share(d.value)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="grid gap-3" aria-hidden={false}>
          {rows.map((d, i) => {
            const pct = max > 0 ? (d.value / max) * 100 : 0;
            const isActive = active === i;
            return (
              <li
                key={d.label}
                tabIndex={0}
                aria-label={`${d.label}: ${format(d.value)}, ${share(d.value)}% of the total`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="group relative grid grid-cols-[minmax(6rem,9rem)_minmax(0,1fr)] items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="truncate text-sm text-muted-foreground" title={d.label}>
                  {d.label}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  {/* the bar: anchored at the baseline (left), 4px rounded at the data end */}
                  <span
                    className={cn("h-3.5 rounded-r-[4px] bg-chart-1 transition-opacity duration-150", active !== null && !isActive && "opacity-40")}
                    style={{ width: `${Math.max(pct, d.value > 0 ? 1 : 0)}%` }}
                  />
                  <span className="tabular shrink-0 text-sm font-semibold">{format(d.value)}</span>
                </span>
                {isActive && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute -top-9 left-[9.75rem] z-10 rounded-md border border-border bg-popover px-2.5 py-1 text-xs whitespace-nowrap shadow-[0_8px_24px_rgb(0_0_0/0.45)]"
                  >
                    <span className="font-semibold">{d.label}</span> · <span className="tabular">{format(d.value)}</span> ·{" "}
                    <span className="tabular text-muted-foreground">{share(d.value)}% of total</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </figure>
  );
}
