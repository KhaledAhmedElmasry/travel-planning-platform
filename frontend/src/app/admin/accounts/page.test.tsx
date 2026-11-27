// P-48 Accounts server page (ACC-14). The page is rendered directly (it is an async function);
// the session, the backend call and the shell are faked.
import { cleanup, render, screen } from "@testing-library/react";
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

// source: Excel ACC-14 actor Admin, "search by name or email and filter by role and status", "paginated";
// PDF .md section 8 GET /api/admin/accounts (ACC-14); openapi query params search, role, status, page
test("only admins load the page, and the URL search, role, status and page go to GET /api/admin/accounts", async () => {
  requireUser.mockResolvedValue(ADMIN);
  getUnreadCount.mockResolvedValue(0);
  backendJson.mockResolvedValue({
    items: [{ id: "u1", name: "Mona Adel", email: "mona@example.com", role: "user", status: "active", registrationDate: "2026-10-15T09:00:00Z" }],
    page: 2, pageSize: 10, total: 11, totalPages: 2,
  });

  const tree = await Page({ searchParams: Promise.resolve({ page: "2", search: "mona", role: "user", status: "active" }) });
  // Vitest cannot render the async child inside <Suspense>: find it and await it directly
  render(await (async function resolve(node: ReactNode): Promise<ReactNode> {
    if (!isValidElement(node)) return node;
    const el = node as ReactElement<{ children?: ReactNode }>;
    if (el.type === Suspense) {
      const child = el.props.children as ReactElement;
      return (child.type as (p: unknown) => Promise<ReactNode>)(child.props);
    }
    if (typeof el.type === "function") return resolve((el.type as (p: unknown) => ReactNode)(el.props));
    const kids = el.props.children;
    if (kids === undefined) return el;
    const resolved = await Promise.all((Array.isArray(kids) ? kids : [kids]).map(resolve));
    return { ...el, props: { ...el.props, children: resolved } };
  })(tree));

  expect(requireUser).toHaveBeenCalledWith(["admin"]);
  expect(backendJson).toHaveBeenCalledTimes(1);
  const url = new URL(backendJson.mock.calls[0][0] as string, "http://x");
  expect(url.pathname).toBe("/api/admin/accounts");
  expect(url.searchParams.get("page")).toBe("2");
  expect(url.searchParams.get("search")).toBe("mona");
  expect(url.searchParams.get("role")).toBe("user");
  expect(url.searchParams.get("status")).toBe("active");
  expect(await screen.findByText("mona@example.com")).toBeTruthy();
});
