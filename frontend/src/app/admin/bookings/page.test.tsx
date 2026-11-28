// P-51 All bookings server page (ACC-17). The page is rendered directly (it is an async function);
// the session, the backend call and the shell are faked.
import { cleanup, render, screen, within } from "@testing-library/react";
import { isValidElement, Suspense, type ReactElement, type ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";

const backendJson = vi.hoisted(() => vi.fn());
const requireUser = vi.hoisted(() => vi.fn());
const getUnreadCount = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/backend", () => ({ backendJson }));
vi.mock("@/lib/server/session", () => ({ requireUser, getUnreadCount }));
vi.mock("@/components/layout/dashboard-shell", () => ({ DashboardShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

import Page from "./page";

afterEach(() => {
  cleanup();
  backendJson.mockReset();
  requireUser.mockReset();
  getUnreadCount.mockReset();
});

const ADMIN = { id: "a1", name: "Admin", email: "admin@x.io", role: "admin", mustChangePassword: false };
const BOOKING = {
  id: "b1", type: "flight", reference: "ABC123",
  user: { name: "Mona Adel" }, provider: { name: "Demo Air" },
  dates: { from: "2027-03-01T10:00:00Z", to: "2027-03-01T14:00:00Z" },
  amount: 25000, currency: "USD", status: "confirmed",
};

// Vitest cannot render the async child inside <Suspense>: replace each Suspense with its awaited child,
// leave every other element to React.
async function resolve(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(resolve));
  if (!isValidElement(node)) return node;
  const el = node as ReactElement<{ children?: ReactNode }>;
  if (el.type === Suspense) {
    const child = el.props.children as ReactElement;
    return (child.type as (p: unknown) => Promise<ReactNode>)(child.props);
  }
  if (el.props.children === undefined) return el;
  return { ...el, props: { ...el.props, children: await resolve(el.props.children) } };
}

async function renderPage(searchParams: Record<string, string>, list: unknown) {
  requireUser.mockResolvedValue(ADMIN);
  getUnreadCount.mockResolvedValue(0);
  backendJson.mockResolvedValue(list);
  render(await resolve(await Page({ searchParams: Promise.resolve(searchParams) })));
}

function backendUrl() {
  expect(backendJson).toHaveBeenCalledTimes(1);
  return new URL(backendJson.mock.calls[0][0] as string, "http://x");
}

// source: Excel ACC-17 actor "Admin"; ACC-11 "admins may view all bookings", others rejected
test("only admins can open the page", async () => {
  await renderPage({}, { items: [BOOKING], page: 1, pageSize: 10, total: 1, totalPages: 1 });
  expect(requireUser).toHaveBeenCalledWith(["admin"]);
});

// source: PDF .md section 8 table row "GET /api/admin/bookings ACC-17"
test("the list is loaded from GET /api/admin/bookings", async () => {
  await renderPage({}, { items: [BOOKING], page: 1, pageSize: 10, total: 1, totalPages: 1 });
  expect(backendUrl().pathname).toBe("/api/admin/bookings");
});

// source: Excel ACC-17 "filterable by type" (flight and hotel bookings)
test("the type filter in the URL is sent to the backend", async () => {
  await renderPage({ type: "hotel" }, { items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
  expect(backendUrl().searchParams.get("type")).toBe("hotel");
});

// source: Excel ACC-17 "filterable by ... status"; GEN-11 status "Expired"
test("the status filter in the URL is sent to the backend", async () => {
  await renderPage({ status: "expired" }, { items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
  expect(backendUrl().searchParams.get("status")).toBe("expired");
});

// source: Excel ACC-17 "filterable by ... date range"
test("the date range in the URL is sent to the backend", async () => {
  await renderPage({ from: "2027-03-01", to: "2027-03-31" }, { items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
  const url = backendUrl();
  expect(url.searchParams.get("from")).toBe("2027-03-01");
  expect(url.searchParams.get("to")).toBe("2027-03-31");
});

// source: Excel ACC-17 "filterable by type, status and date range" (the admin needs a control for each)
test("the page offers type, status, from and to filter controls", async () => {
  await renderPage({}, { items: [BOOKING], page: 1, pageSize: 10, total: 1, totalPages: 1 });
  const form = document.querySelector("form") as HTMLFormElement;
  expect(within(form).getByLabelText("Type")).toBeTruthy();
  expect(within(form).getByLabelText("Status")).toBeTruthy();
  expect(within(form).getByLabelText("From")).toBeTruthy();
  expect(within(form).getByLabelText("To")).toBeTruthy();
});

// source: Excel ACC-17 list columns "(reference, user, provider, dates, amount, status)"
test("the table has the six ACC-17 columns", async () => {
  await renderPage({}, { items: [BOOKING], page: 1, pageSize: 10, total: 1, totalPages: 1 });
  const headers = within(screen.getByRole("table")).getAllByRole("columnheader").map((h) => h.textContent?.trim().toLowerCase());
  expect(headers).toEqual(["reference", "user", "provider", "dates", "amount", "status"]);
});

// source: Excel ACC-17 "reference, user, provider" of each booking
test("a row shows the booking reference, user name and provider name", async () => {
  await renderPage({}, { items: [BOOKING], page: 1, pageSize: 10, total: 1, totalPages: 1 });
  const row = within(screen.getByRole("table")).getAllByRole("row")[1];
  expect(within(row).getByText("ABC123")).toBeTruthy();
  expect(within(row).getByText("Mona Adel")).toBeTruthy();
  expect(within(row).getByText("Demo Air")).toBeTruthy();
});

// source: Excel ACC-17 "read-only list" (no actions on bookings)
test("the bookings table has no buttons or action links", async () => {
  await renderPage({}, { items: [BOOKING], page: 1, pageSize: 10, total: 1, totalPages: 1 });
  const table = screen.getByRole("table");
  expect(within(table).queryAllByRole("button")).toHaveLength(0);
  expect(within(table).queryAllByRole("link")).toHaveLength(0);
});

// source: GEN-04 "friendly empty states when a list or search has no results"
test("no bookings shows an empty state instead of a table", async () => {
  await renderPage({ status: "cancelled" }, { items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
  expect(screen.queryByRole("table")).toBeNull();
});

// source: GEN-05 "paginate every list longer than 10 rows"
test("the page number in the URL is sent to the backend", async () => {
  await renderPage({ page: "2" }, { items: [BOOKING], page: 2, pageSize: 10, total: 11, totalPages: 2 });
  expect(backendUrl().searchParams.get("page")).toBe("2");
});

// source: GEN-05 "paginate every list longer than 10 rows (page size 10)": 11 bookings = 2 pages
test("with 11 bookings there is a link to the next page", async () => {
  await renderPage({}, { items: [BOOKING], page: 1, pageSize: 10, total: 11, totalPages: 2 });
  const next = within(screen.getByRole("navigation", { name: "Pagination" })).getByRole("link", { name: "Next page" });
  const href = new URL(next.getAttribute("href") as string, "http://x");
  expect(href.pathname).toBe("/admin/bookings");
  expect(href.searchParams.get("page")).toBe("2");
});
