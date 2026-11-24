// Admin home (/admin): open reports count + list, account stats, recent audit log, quick actions
// (ACC-04; spec section 2, Admin row).
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { AdminOverview, type AuditEntry, type OpenReport } from "./admin-overview";

afterEach(cleanup);

// source: openapi ReportList item (GET /api/admin/reports?status=open)
const report = (i: number): OpenReport => ({
  id: `rp${i}`,
  contentType: "post",
  contentId: `c${i}`,
  contentPreview: `Preview ${i}`,
  reporter: { id: "u1", name: "Mona Adel", email: "mona@example.com" },
  reason: `Reason ${i}`,
  status: "open",
  createdAt: "2026-11-20T10:00:00.000Z",
});
// source: openapi AuditLogList item (GET /api/admin/audit-logs)
const entry = (i: number): AuditEntry => ({
  id: `al${i}`,
  admin: { id: "a1", name: "Platform Admin", email: "admin@example.com" },
  action: "suspend_account",
  targetType: "user",
  targetId: `t${i}`,
  reason: null,
  createdAt: "2026-11-21T09:00:00.000Z",
});
const stats = { users: 120, moderators: 9, suspended: 3 };

// source: MILESTONE2_FRONTEND_SPEC.md section 2 Admin row - open reports count + list; "Good to know": GET /api/admin/reports?status= gives the count
test("the open reports count is the backend total, and each open report shows its content, reason and date", () => {
  render(<AdminOverview openReports={[report(1)]} openReportsTotal={12} accounts={stats} audit={[]} />);

  expect(screen.getByText("Open reports", { selector: "span" }).parentElement!.textContent).toBe("Open reports12");
  const list = screen.getByRole("region", { name: "Open reports" }).textContent!;
  expect(list).toContain("Post");
  expect(list).toContain("Preview 1");
  expect(list).toContain("Reason 1");
  expect(list).toContain("20 Nov 2026");
});

// source: MILESTONE2_FRONTEND_SPEC.md section 2 Admin row - account stats (users, moderators, suspended)
test("account stats show users, moderators and suspended accounts", () => {
  render(<AdminOverview openReports={[]} openReportsTotal={0} accounts={stats} audit={[]} />);

  expect(screen.getByText("Users").parentElement!.textContent).toBe("Users120");
  expect(screen.getByText("Moderators").parentElement!.textContent).toBe("Moderators9");
  expect(screen.getByText("Suspended").parentElement!.textContent).toBe("Suspended3");
});

// source: team leader decision 24 Nov - lists on the homes show 5 items + a "See all" link
test("open reports and audit entries show 5 each, with See all to their pages", () => {
  const six = [1, 2, 3, 4, 5, 6];
  render(<AdminOverview openReports={six.map(report)} openReportsTotal={6} accounts={stats} audit={six.map(entry)} />);

  const reports = screen.getByRole("region", { name: "Open reports" });
  expect(within(reports).getAllByRole("listitem")).toHaveLength(5);
  expect(reports.textContent).not.toContain("Preview 6");
  expect(within(reports).getByRole("link", { name: "See all" }).getAttribute("href")).toBe("/admin/reports");

  const audit = screen.getByRole("region", { name: "Recent audit log" });
  expect(within(audit).getAllByRole("listitem")).toHaveLength(5);
  expect(within(audit).getByRole("link", { name: "See all" }).getAttribute("href")).toBe("/admin/audit-log");
});

// source: MILESTONE2_FRONTEND_SPEC.md P-53 - admin actions with date, admin, action and target
test("an audit entry shows the action, the admin, the target and the date", () => {
  render(<AdminOverview openReports={[]} openReportsTotal={0} accounts={stats} audit={[entry(1)]} />);

  const text = screen.getByRole("region", { name: "Recent audit log" }).textContent!;
  expect(text).toContain("Suspend account");
  expect(text).toContain("Platform Admin");
  expect(text).toContain("user t1");
  expect(text).toContain("21 Nov 2026");
});

// source: Excel GEN-04 - empty lists show a helpful message
test("no open report says so", () => {
  render(<AdminOverview openReports={[]} openReportsTotal={0} accounts={stats} audit={[]} />);
  expect(within(screen.getByRole("region", { name: "Open reports" })).getByText("No open reports")).toBeTruthy();
});

// source: MILESTONE2_FRONTEND_SPEC.md section 2 Admin row - quick actions (create moderator, create airline/hotel); routes in src/lib/nav.ts, P-50 creates airlines and hotels
test("quick actions open create moderator and the providers page", () => {
  render(<AdminOverview openReports={[]} openReportsTotal={0} accounts={stats} audit={[]} />);
  const links = within(screen.getByRole("region", { name: "Quick actions" }))
    .getAllByRole("link")
    .map((a) => [a.textContent, a.getAttribute("href")]);
  expect(links).toEqual([
    ["Create moderator", "/admin/moderators/new"],
    ["Create airline", "/admin/providers"],
    ["Create hotel", "/admin/providers"],
  ]);
});
