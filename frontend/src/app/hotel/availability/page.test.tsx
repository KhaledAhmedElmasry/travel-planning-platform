// Hotel availability server page (HTL-08). The page is an async function rendered directly; the
// session, the backend call and the shell are faked. The room list inside <Suspense> is an async
// component, so the tests find it in the returned tree and await it themselves.
import { cleanup, render, screen } from "@testing-library/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";

const backendJson = vi.hoisted(() => vi.fn());
const requireUser = vi.hoisted(() => vi.fn());
const getUnreadCount = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/backend", () => ({ backendJson }));
vi.mock("@/lib/server/session", () => ({ requireUser, getUnreadCount }));
vi.mock("@/components/layout/dashboard-shell", () => ({
  DashboardShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

import Page from "./page";

afterEach(() => {
  cleanup();
  backendJson.mockReset();
  requireUser.mockReset();
  getUnreadCount.mockReset();
});

const MODERATOR = { id: "m1", name: "Hotel Mod", email: "m@x.io", role: "hotel_moderator", hotelId: "h1", mustChangePassword: false };

type AsyncComponent = (props: Record<string, unknown>) => Promise<ReactElement>;

// The first element in the tree whose component is async (the room list inside Suspense).
function findAsyncChild(node: ReactNode): ReactElement<Record<string, unknown>> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findAsyncChild(child);
      if (found) return found;
    }
    return undefined;
  }
  if (!isValidElement<Record<string, unknown>>(node)) return undefined;
  if (typeof node.type === "function" && node.type.constructor.name === "AsyncFunction") return node;
  return findAsyncChild(node.props.children as ReactNode);
}

async function renderList(params: Record<string, string>) {
  requireUser.mockResolvedValue(MODERATOR);
  getUnreadCount.mockResolvedValue(0);
  const tree = await Page({ searchParams: Promise.resolve(params) });
  const list = findAsyncChild(tree);
  if (!list) throw new Error("room list not found");
  render(await (list.type as AsyncComponent)(list.props));
}

const night = (date: string) => ({ date, status: "available" as const, reference: null });
const room = (n: number) => ({ id: `r${n}`, roomNumber: String(100 + n), dates: [night("2027-03-01")] });

// source: Excel HTL-08 actor "Hotel Moderator"; PDF section 3 "Hotel Moderator: manages exactly one assigned hotel"
test("only hotel moderators open the page", async () => {
  backendJson.mockResolvedValue({ items: [room(1)], page: 1, pageSize: 10, total: 1, totalPages: 1 });
  await renderList({ from: "2027-03-01", to: "2027-03-05" });
  expect(requireUser).toHaveBeenCalledWith(["hotel_moderator"]);
});

// source: PDF 8.5 "GET /api/hotels/:id/availability HTL-08"; Excel HTL-08 "for a chosen date range"; PDF 3 own hotel only
test("the chosen range is loaded from GET /api/hotels/{own hotel}/availability", async () => {
  backendJson.mockResolvedValue({ items: [room(1)], page: 1, pageSize: 10, total: 1, totalPages: 1 });
  await renderList({ from: "2027-03-01", to: "2027-03-05" });
  expect(backendJson).toHaveBeenCalledTimes(1);
  const url = String(backendJson.mock.calls[0][0]);
  expect(url.startsWith("/api/hotels/h1/availability?")).toBe(true);
  expect(url).toContain("2027-03-01");
  expect(url).toContain("2027-03-05");
});

// source: Excel HTL-08 "view each room's status" - the rooms returned for the range are shown
test("the rooms of the hotel are shown in the calendar", async () => {
  backendJson.mockResolvedValue({ items: [room(1), room(2)], page: 1, pageSize: 10, total: 2, totalPages: 1 });
  await renderList({ from: "2027-03-01", to: "2027-03-01" });
  expect(screen.getByRole("row", { name: /101/ })).toBeTruthy();
  expect(screen.getByRole("row", { name: /102/ })).toBeTruthy();
});

// source: Excel GEN-05 "paginate every list longer than 10 rows (page size 10)"
test("more than 10 rooms are paginated", async () => {
  const items = Array.from({ length: 10 }, (_, i) => room(i + 1));
  backendJson.mockResolvedValue({ items, page: 1, pageSize: 10, total: 11, totalPages: 2 });
  await renderList({ from: "2027-03-01", to: "2027-03-01" });
  expect(screen.getByRole("navigation", { name: "Pagination" })).toBeTruthy();
});

// source: Excel GEN-05 "every list longer than 10 rows" - 10 rows or fewer need no pagination
test("10 rooms or fewer are not paginated", async () => {
  const items = Array.from({ length: 10 }, (_, i) => room(i + 1));
  backendJson.mockResolvedValue({ items, page: 1, pageSize: 10, total: 10, totalPages: 1 });
  await renderList({ from: "2027-03-01", to: "2027-03-01" });
  expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
});

// source: Excel GEN-05 page size 10 - the page number in the URL selects which 10 rooms are loaded
test("the page number in the URL is sent to the backend", async () => {
  backendJson.mockResolvedValue({ items: [room(11)], page: 2, pageSize: 10, total: 11, totalPages: 2 });
  await renderList({ from: "2027-03-01", to: "2027-03-01", page: "2" });
  expect(String(backendJson.mock.calls[0][0])).toMatch(/[?&]page=2(&|$)/);
});

// source: Excel GEN-04 "friendly empty states when a list ... has no results"
test("a hotel without rooms gets an empty state instead of an empty calendar", async () => {
  backendJson.mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
  await renderList({ from: "2027-03-01", to: "2027-03-01" });
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.getByRole("heading").textContent?.trim()).toBeTruthy();
});

// source: Excel GEN-16 "clear feedback ... error states" - a failed load is not shown as an empty or partial calendar
test("a failed load raises an error instead of showing a calendar", async () => {
  requireUser.mockResolvedValue(MODERATOR);
  getUnreadCount.mockResolvedValue(0);
  backendJson.mockResolvedValue(null);
  const tree = await Page({ searchParams: Promise.resolve({ from: "2027-03-01", to: "2027-03-01" }) });
  const list = findAsyncChild(tree)!;
  await expect((list.type as AsyncComponent)(list.props)).rejects.toThrow();
});
