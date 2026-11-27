// AccountsTable
// Part: T7 Admin dashboard
// Requirements: ACC-14, ACC-15, ACC-16, ACC-07a
// Used by: P-48
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { FormErrorSummary } from "@/components/app/form-error-summary";
import { FormField } from "@/components/app/form-field";
import { PaginationBar } from "@/components/app/pagination-bar";
import { PasswordInput } from "@/components/app/password-input";
import { StatusBadge } from "@/components/app/status-badge";
import { apiFetch, ApiError } from "@/lib/api";
import { fieldErrorMap } from "@/lib/api-error";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Role = "user" | "admin" | "airline_moderator" | "hotel_moderator";
type AccountStatus = "active" | "suspended" | "deactivated";
type Account = { id: string; name: string; email: string; role: Role; status: AccountStatus; registrationDate: string };
export type AccountList = { items: Account[]; page: number; pageSize: number; total: number; totalPages: number };
type AccountFilters = { page: number; search: string; role: Role | ""; status: AccountStatus | "" };
type AccountsTableProps = { accounts: AccountList; filters: AccountFilters };

const ROLE_LABELS: Record<Role, string> = { user: "Traveler", admin: "Admin", airline_moderator: "Airline moderator", hotel_moderator: "Hotel moderator" };

function hrefFor(filters: AccountFilters, page: number): string {
  const params = new URLSearchParams({ page: String(page) });
  if (filters.search) params.set("search", filters.search);
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  return `/admin/accounts?${params.toString()}`;
}

function ResetPasswordDialog({ account }: { account: Account }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setErrors({}); setMessage(undefined); setSaving(true);
    try {
      await apiFetch(`/api/admin/users/${account.id}/reset-password`, { method: "POST", json: { temporaryPassword } });
      setTemporaryPassword(""); setOpen(false); toast.success("Temporary password set."); router.refresh();
    } catch (error) {
      setErrors(error instanceof ApiError ? fieldErrorMap(error.body) : {});
      setMessage(error instanceof ApiError ? error.message : "We couldn't reset this password. Please try again.");
    } finally { setSaving(false); }
  }
  return <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}><DialogTrigger asChild><Button variant="outline" size="sm">Reset password</Button></DialogTrigger><DialogContent showCloseButton={!saving}><DialogHeader><DialogTitle>Reset password</DialogTitle><DialogDescription>Set a temporary password for {account.name}. They must change it when they next log in.</DialogDescription></DialogHeader><form className="grid gap-5" onSubmit={submit}><FormErrorSummary errors={errors} labels={{ temporaryPassword: "Temporary password" }} message={message} /><FormField label="Temporary password" name="temporaryPassword" required error={errors.temporaryPassword} hint="The account must replace this password at its next login."><PasswordInput autoComplete="new-password" showRules value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} /></FormField><DialogFooter><DialogClose asChild><Button type="button" variant="outline" disabled={saving}>Cancel</Button></DialogClose><Button type="submit" loading={saving}>Set temporary password</Button></DialogFooter></form></DialogContent></Dialog>;
}

function AccountActions({ account }: { account: Account }) {
  const router = useRouter();
  const isSuspended = account.status === "suspended";
  async function changeStatus() {
    const action = isSuspended ? "reactivate" : "suspend";
    try { await apiFetch(`/api/admin/accounts/${account.id}/${action}`, { method: "PATCH" }); toast.success(isSuspended ? "Account reactivated." : "Account suspended."); router.refresh(); }
    catch (error) { toast.error(error instanceof ApiError ? error.message : "We couldn't update this account. Please try again."); throw error; }
  }
  return <div className="flex flex-wrap justify-end gap-2">{account.status !== "deactivated" && <ConfirmDialog trigger={<Button variant={isSuspended ? "secondary" : "destructive"} size="sm">{isSuspended ? "Reactivate" : "Suspend"}</Button>} title={isSuspended ? "Reactivate this account?" : "Suspend this account?"} description={isSuspended ? `${account.name} will be able to log in again.` : `${account.name} will no longer be able to log in. Their existing bookings remain valid.`} confirmLabel={isSuspended ? "Reactivate account" : "Suspend account"} tone={isSuspended ? "default" : "destructive"} onConfirm={changeStatus} />}<ResetPasswordDialog account={account} /></div>;
}

export function AccountsTable({ accounts, filters }: AccountsTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.search);
  const [role, setRole] = useState<Role | "">(filters.role);
  const [status, setStatus] = useState<AccountStatus | "">(filters.status);
  function applyFilters(event: FormEvent<HTMLFormElement>) { event.preventDefault(); router.push(hrefFor({ page: 1, search: search.trim(), role, status }, 1)); }
  return <div className="grid gap-6"><form className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={applyFilters}><FormField label="Search" name="search" hint="Search by name or email."><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search accounts" /></FormField><FormField label="Role" name="role"><Select value={role || "all"} onValueChange={(value) => setRole(value === "all" ? "" : value as Role)}><SelectTrigger className="w-full"><SelectValue placeholder="All roles" /></SelectTrigger><SelectContent><SelectItem value="all">All roles</SelectItem>{Object.entries(ROLE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></FormField><FormField label="Status" name="status"><Select value={status || "all"} onValueChange={(value) => setStatus(value === "all" ? "" : value as AccountStatus)}><SelectTrigger className="w-full"><SelectValue placeholder="All statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="suspended">Suspended</SelectItem><SelectItem value="deactivated">Deactivated</SelectItem></SelectContent></Select></FormField><div className="flex items-end"><Button type="submit" className="w-full">Apply filters</Button></div></form><DataTable caption="Accounts" rows={accounts.items} rowKey={(account) => account.id} columns={[{ header: "Name", cell: (account) => <span className="font-medium">{account.name}</span> }, { header: "Email", cell: (account) => account.email, hideOnMobile: true }, { header: "Role", cell: (account) => ROLE_LABELS[account.role], hideOnMobile: true }, { header: "Status", cell: (account) => <StatusBadge kind="account" status={account.status} /> }, { header: "Registered", cell: (account) => formatDate(account.registrationDate), hideOnMobile: true }, { header: "Actions", align: "end", cell: (account) => account.role === "admin" ? null : <AccountActions account={account} /> }]} empty={<EmptyState title="No accounts match these filters" line="Nothing here... try another search?" description="Try changing the search term, role, or status." compact />} /><PaginationBar page={accounts.page} totalPages={accounts.totalPages} total={accounts.total} pageSize={accounts.pageSize} hrefFor={(page) => hrefFor(filters, page)} /></div>;
}
