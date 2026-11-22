// <PaginationBar page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} hrefFor={(p) => `?page=${p}`} />
// Every list longer than 10 items is paginated (GEN-05). Pass the backend's
// paginated response fields { page, pageSize, total, totalPages }.
// Uses links (?page=2), so it works in server-rendered pages and keeps the page
// in the URL (back button and shared links land on the same page).
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";

type PaginationBarProps = {
  page: number;
  totalPages: number;
  total?: number;
  pageSize?: number;
  /** Builds the link for a page, keeping the other filters: (p) => `?status=open&page=${p}` */
  hrefFor: (page: number) => string;
  className?: string;
};

/** 1 ... 4 5 [6] 7 8 ... 20 */
function pageList(page: number, totalPages: number): (number | "gap")[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

export function PaginationBar({ page, totalPages, total, pageSize = 10, hrefFor, className }: PaginationBarProps) {
  if (totalPages <= 1) return null;
  const first = (page - 1) * pageSize + 1;
  const last = total !== undefined ? Math.min(page * pageSize, total) : page * pageSize;
  const box =
    "grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-sm font-medium transition-colors";

  return (
    <nav aria-label="Pagination" className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      {total !== undefined ? (
        <p className="tabular text-sm text-muted-foreground">
          Showing {first}–{last} of {total.toLocaleString("en-US")}
        </p>
      ) : (
        <span />
      )}
      <ul className="flex items-center gap-1">
        <li>
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} className={cn(box, "border-border bg-card hover:border-input")} aria-label="Previous page">
              <ChevronLeftIcon className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <span className={cn(box, "border-border opacity-40")} aria-hidden="true">
              <ChevronLeftIcon className="size-4" />
            </span>
          )}
        </li>
        {pageList(page, totalPages).map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`} className="px-1 text-subtle-foreground" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={hrefFor(p)}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  box,
                  "tabular",
                  p === page
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-input",
                )}
              >
                {p}
              </Link>
            </li>
          ),
        )}
        <li>
          {page < totalPages ? (
            <Link href={hrefFor(page + 1)} className={cn(box, "border-border bg-card hover:border-input")} aria-label="Next page">
              <ChevronRightIcon className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <span className={cn(box, "border-border opacity-40")} aria-hidden="true">
              <ChevronRightIcon className="size-4" />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
