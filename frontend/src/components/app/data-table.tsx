// Tables for admin and moderator pages (ACC-14 accounts, ACC-17 bookings, GEN-07
// audit log, FLT-29 passengers, HTL-22 reservations).
// <DataTable
//   caption="Accounts"
//   rows={data.items}
//   rowKey={(u) => u.id}
//   columns={[
//     { header: "Name", cell: (u) => u.name },
//     { header: "Status", cell: (u) => <StatusBadge kind="account" status={u.status} /> },
//     { header: "Joined", cell: (u) => formatDate(u.createdAt), align: "end" },
//   ]}
//   empty={<EmptyState compact title="No accounts match these filters" />}
// />
// Put <PaginationBar> under it. The table scrolls sideways inside its own box on
// small screens, so the page itself never scrolls sideways.
import type { ReactNode } from "react";
import { cn } from "cn";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  align?: "start" | "end";
  /** Hide on phones (keep the 2-3 most important columns visible). */
  hideOnMobile?: boolean;
};

type DataTableProps<T> = {
  /** Read by screen readers; visually hidden. */
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Shown instead of the table when rows is empty (GEN-04). */
  empty?: ReactNode;
  className?: string;
};

export function DataTable<T>({ caption, columns, rows, rowKey, empty, className }: DataTableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border bg-card", className)}>
      <Table>
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            {columns.map((col) => (
              <TableHead
                key={col.header}
                scope="col"
                className={cn(
                  "h-11 px-4 text-xs font-semibold tracking-wide text-subtle-foreground uppercase",
                  col.align === "end" && "text-right",
                  col.hideOnMobile && "hidden md:table-cell",
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={rowKey(row)}>
              {columns.map((col) => (
                <TableCell
                  key={col.header}
                  className={cn(
                    "px-4 py-3",
                    col.align === "end" && "text-right",
                    col.hideOnMobile && "hidden md:table-cell",
                  )}
                >
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
