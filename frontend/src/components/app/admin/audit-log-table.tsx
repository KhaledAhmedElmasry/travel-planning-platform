// AuditLogTable
// Part: T7 Admin dashboard
// Requirements: GEN-07
// Used by: P-53
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { FormField } from "@/components/app/form-field";
import { PaginationBar } from "@/components/app/pagination-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format";

const ACTIONS = [
  "create_moderator",
  "suspend_account",
  "reactivate_account",
  "reset_password",
  "dismiss_report",
  "hide_content",
  "delete_content",
  "deactivate_airline",
  "reactivate_airline",
  "deactivate_hotel",
  "reactivate_hotel",
] as const;

export type AuditLogFilters = {
  page: number;
  action: (typeof ACTIONS)[number] | "";
  from: string;
  to: string;
};

type AuditLogItem = {
  id: string;
  admin: { id: string; name: string; email: string };
  action: (typeof ACTIONS)[number];
  targetType: string;
  targetId: string;
  createdAt: string;
};

export type AuditLogList = {
  items: AuditLogItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type AuditLogTableProps = {
  filters: AuditLogFilters;
  auditLogs?: AuditLogList;
  rangeError?: string;
};

function sentenceCase(value: string): string {
  const words = value.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function hrefFor(filters: AuditLogFilters, page: number): string {
  const params = new URLSearchParams({ page: String(page) });
  if (filters.action) params.set("action", filters.action);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return `/admin/audit-log?${params.toString()}`;
}

export function AuditLogTable({ filters, auditLogs, rangeError }: AuditLogTableProps) {
  const isFiltered = Boolean(filters.action || filters.from || filters.to);
  const emptyTitle = isFiltered ? "No entries match these filters" : "No audit log entries";
  const pastLastPage = auditLogs && auditLogs.items.length === 0 && filters.page > auditLogs.totalPages;
  const empty = pastLastPage ? (
    <EmptyState
      title={emptyTitle}
      action={<Button asChild variant="outline"><Link href={hrefFor(filters, 1)}>Go to page 1</Link></Button>}
    />
  ) : (
    <EmptyState title={emptyTitle} />
  );

  return (
    <div className="grid gap-5">
      <form method="get" action="/admin/audit-log" className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="Action" name="action">
          <Select defaultValue={filters.action || "all"}>
            <SelectTrigger className="w-full"><SelectValue placeholder="All actions" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {ACTIONS.map((action) => <SelectItem key={action} value={action}>{sentenceCase(action)}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="From" name="from">
          <Input type="date" defaultValue={filters.from} />
        </FormField>
        <FormField label="To" name="to" error={rangeError}>
          <Input type="date" defaultValue={filters.to} />
        </FormField>
        <div className="flex items-end gap-3">
          <Button type="submit" className="flex-1">Apply filters</Button>
          <Button asChild type="button" variant="outline" className="flex-1"><Link href="/admin/audit-log">Clear filters</Link></Button>
        </div>
      </form>
      {auditLogs && (
        <>
          <DataTable
            caption="Audit log entries"
            rows={auditLogs.items}
            rowKey={(item) => item.id}
            columns={[
              { header: "Date", cell: (item) => formatDate(item.createdAt) },
              { header: "Admin", cell: (item) => item.admin.name, hideOnMobile: true },
              { header: "Action", cell: (item) => sentenceCase(item.action) },
              { header: "Target", cell: (item) => <div className="grid min-w-24 gap-1"><span>{sentenceCase(item.targetType)}</span><span className="break-all text-sm text-muted-foreground">{item.targetId}</span></div> },
            ]}
            empty={empty}
          />
          <PaginationBar
            page={auditLogs.page}
            totalPages={auditLogs.totalPages}
            total={auditLogs.total}
            pageSize={auditLogs.pageSize}
            hrefFor={(page) => hrefFor(filters, page)}
          />
        </>
      )}
    </div>
  );
}
