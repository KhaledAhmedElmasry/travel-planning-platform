// P-48 Accounts table (ACC-14, ACC-15, ACC-16, ACC-07a): list, search/filters, pagination,
// suspend/reactivate and admin password reset. Only fetch, the router and the toast are faked.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const refresh = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push, replace: vi.fn() }) }));

import { AccountsTable, type AccountList } from "./accounts-table";

beforeAll(() => {
  // Radix Select needs these in jsdom (same as profile-form.test.tsx)
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toast.success.mockReset();
  toast.error.mockReset();
  refresh.mockReset();
  push.mockReset();
});

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// openapi GET /api/admin/accounts items: id, name, email, role (Role enum), status (AccountStatus enum), registrationDate
const mona = { id: "u1", name: "Mona Adel", email: "mona@example.com", role: "user" as const, status: "active" as const, registrationDate: "2026-10-15T09:00:00Z" };
const omar = { id: "u2", name: "Omar Hotelier", email: "omar@example.com", role: "hotel_moderator" as const, status: "suspended" as const, registrationDate: "2026-09-03T09:00:00Z" };

const NO_FILTERS = { page: 1, search: "", role: "" as const, status: "" as const };
const list = (items: AccountList["items"], over: Partial<AccountList> = {}): AccountList => ({
  items, page: 1, pageSize: 10, total: items.length, totalPages: items.length ? 1 : 0, ...over,
});

const row = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;

// source: Excel ACC-14 "view a paginated list of all accounts (name, email, role, status, registration date)";
// PDF .md section 4 role names (Hotel Moderator); openapi AccountStatus enum (suspended)
test("each account row shows its name, email, role, status and registration date", () => {
  render(<AccountsTable accounts={list([mona, omar])} filters={NO_FILTERS} />);

  const r = within(row("Omar Hotelier"));
  expect(r.getByText("omar@example.com")).toBeTruthy();
  expect(r.getByText(/hotel moderator/i)).toBeTruthy();
  expect(r.getByText(/suspended/i)).toBeTruthy();
  // registration date 2026-09-03 is shown (display format not fixed by the sources: day + year only)
  expect(row("Omar Hotelier").textContent).toMatch(/\D0?3\D.*2026|2026\D+0?9\D+0?3(\D|$)/);

  expect(within(row("Mona Adel")).getByText("mona@example.com")).toBeTruthy();
  expect(within(row("Mona Adel")).getByText(/active/i)).toBeTruthy();
});

// source: Excel ACC-14 "search by name or email and filter by role and status";
// openapi GET /api/admin/accounts query params search, role (Role), status (AccountStatus); spec page P-48 = /admin/accounts
test("search, role and status filters are applied together", async () => {
  render(<AccountsTable accounts={list([mona])} filters={NO_FILTERS} />);

  fireEvent.change(screen.getByRole("textbox", { name: /search/i }), { target: { value: "omar" } });
  // the two Selects are found by order (Role first, then Status): their triggers carry no accessible name, see report
  const [roleSelect, statusSelect] = screen.getAllByRole("combobox");
  fireEvent.keyDown(roleSelect, { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: /hotel moderator/i }));
  fireEvent.keyDown(statusSelect, { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: /suspended/i }));
  fireEvent.click(screen.getByRole("button", { name: /apply/i }));

  expect(push).toHaveBeenCalledTimes(1);
  const url = new URL(push.mock.calls[0][0] as string, "http://x");
  expect(url.pathname).toBe("/admin/accounts");
  expect(url.searchParams.get("search")).toBe("omar");
  expect(url.searchParams.get("role")).toBe("hotel_moderator");
  expect(url.searchParams.get("status")).toBe("suspended");
});

// source: Excel ACC-14 "paginated list" + "filter"; Excel GEN-05 "paginate every list longer than 10 rows (page size 10)"
test("the next page link keeps the current search and filters", () => {
  const filters = { page: 1, search: "mona", role: "user" as const, status: "active" as const };
  render(<AccountsTable accounts={list([mona], { total: 12, totalPages: 2 })} filters={filters} />);

  const next = new URL(screen.getByRole("link", { name: /next page/i }).getAttribute("href") as string, "http://x");
  expect(next.searchParams.get("page")).toBe("2");
  expect(next.searchParams.get("search")).toBe("mona");
  expect(next.searchParams.get("role")).toBe("user");
  expect(next.searchParams.get("status")).toBe("active");
});

// source: Excel GEN-04 "friendly empty states when a list or search has no results"
test("no matching accounts shows an empty state instead of rows", () => {
  render(<AccountsTable accounts={list([])} filters={{ ...NO_FILTERS, search: "nobody" }} />);

  expect(screen.queryByText("mona@example.com")).toBeNull();
  expect(screen.getByRole("heading", { level: 2 })).toBeTruthy();
});

// source: Excel ACC-16 "suspend ... registered users"; PDF .md section 8 PATCH /api/admin/accounts/:id/suspend (ACC-15, ACC-16);
// Excel GEN-03 confirmation before destructive actions; Excel GEN-16 success feedback
test("Suspend asks first, then suspends the account and reloads the list", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ...mona, status: "suspended" }));
  vi.stubGlobal("fetch", fetchMock);
  render(<AccountsTable accounts={list([mona])} filters={NO_FILTERS} />);

  fireEvent.click(within(row("Mona Adel")).getByRole("button", { name: /^suspend/i }));
  expect(fetchMock).not.toHaveBeenCalled();
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: /suspend/i }));

  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("/api/admin/accounts/u1/suspend");
  expect(init.method).toBe("PATCH");
  expect(toast.success).toHaveBeenCalledTimes(1);
});

// source: Excel ACC-15 "suspend and reactivate a moderator account"; PDF .md section 8 PATCH /api/admin/accounts/:id/reactivate
test("a suspended account offers Reactivate, which reactivates it", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ...omar, status: "active" }));
  vi.stubGlobal("fetch", fetchMock);
  render(<AccountsTable accounts={list([omar])} filters={NO_FILTERS} />);

  expect(within(row("Omar Hotelier")).queryByRole("button", { name: /^suspend/i })).toBeNull();
  fireEvent.click(within(row("Omar Hotelier")).getByRole("button", { name: /^reactivate/i }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: /reactivate/i }));

  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("/api/admin/accounts/u2/reactivate");
  expect(init.method).toBe("PATCH");
});

// source: Excel GEN-16 "understandable error messages"; openapi PATCH .../suspend 409 (Error schema message)
test("a refused suspension shows the backend message and does not reload", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(409, { statusCode: 409, error: "Conflict", message: "Account is already suspended." }));
  vi.stubGlobal("fetch", fetchMock);
  render(<AccountsTable accounts={list([mona])} filters={NO_FILTERS} />);

  fireEvent.click(within(row("Mona Adel")).getByRole("button", { name: /^suspend/i }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: /suspend/i }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Account is already suspended."));
  expect(refresh).not.toHaveBeenCalled();
});

// source: Excel ACC-07a "reset a user's or moderator's password to a temporary password";
// PDF .md section 8 POST /api/admin/users/:id/reset-password; openapi AdminResetPasswordRequest { temporaryPassword }
test("Reset password sends the temporary password for that account", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { message: "ok" }));
  vi.stubGlobal("fetch", fetchMock);
  render(<AccountsTable accounts={list([mona, omar])} filters={NO_FILTERS} />);

  fireEvent.click(within(row("Omar Hotelier")).getByRole("button", { name: /reset password/i }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText(/temporary password/i), { target: { value: "Temp2026x" } });
  fireEvent.submit(within(dialog).getByLabelText(/temporary password/i).closest("form") as HTMLFormElement);

  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { body: string }];
  expect(url).toBe("/api/admin/users/u2/reset-password");
  expect(init.method).toBe("POST");
  expect(JSON.parse(init.body)).toEqual({ temporaryPassword: "Temp2026x" });
  expect(toast.success).toHaveBeenCalledTimes(1);
});

// source: Excel GEN-02 "field-level validation messages on all forms"; openapi reset-password 400 (Error.fieldErrors)
test("a rejected temporary password shows the field message from the backend", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(400, {
    statusCode: 400, error: "Bad Request", message: "Validation failed",
    fieldErrors: [{ field: "temporaryPassword", messages: ["Password must contain a letter and a number."] }],
  }));
  vi.stubGlobal("fetch", fetchMock);
  render(<AccountsTable accounts={list([mona])} filters={NO_FILTERS} />);

  fireEvent.click(within(row("Mona Adel")).getByRole("button", { name: /reset password/i }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText(/temporary password/i), { target: { value: "abcdefgh" } });
  fireEvent.submit(within(dialog).getByLabelText(/temporary password/i).closest("form") as HTMLFormElement);

  expect((await within(dialog).findAllByText("Password must contain a letter and a number.")).length).toBeGreaterThan(0);
  expect(refresh).not.toHaveBeenCalled();
});
