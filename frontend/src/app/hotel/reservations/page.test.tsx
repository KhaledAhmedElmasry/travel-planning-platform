// P-47 Reservations server page (HTL-22). The page is rendered directly (it is an async function);
// the session, the backend call and the shell are faked.
import { cleanup, render, screen, within } from "@testing-library/react";
import { isValidElement, Suspense, type ReactElement, type ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { formatDay } from "@/lib/dates";

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

const MODERATOR = { id: "m1", name: "Hotel Mod", email: "mod@x.io", role: "hotel_moderator", hotelId: "h1", mustChangePassword: false };

const reservation = (id: string, guest: string, checkIn: string, checkOut: string, status: string) => ({
  id,
  reference: `TP${id.toUpperCase()}`,
  guest: { id: `u-${id}`, name: guest },
  rooms: [{ roomId: "r1", roomNumber: "101", type: "Double" }],
  checkIn,
  checkOut,
  status,
});

// Vitest cannot render the async child inside <Suspense>: find it and await it directly
async function resolve(node: ReactNode): Promise<ReactNode> {
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
}

// Finds the fallback of the <Suspense> boundary without resolving its child
function findFallback(node: ReactNode): ReactNode {
  if (!isValidElement(node)) return null;
  const el = node as ReactElement<{ children?: ReactNode; fallback?: ReactNode }>;
  if (el.type === Suspense) return el.props.fallback;
  if (typeof el.type === "function") return findFallback((el.type as (p: unknown) => ReactNode)(el.props));
  const kids = el.props.children;
  for (const kid of Array.isArray(kids) ? kids : [kids]) {
    const found = findFallback(kid);
    if (found) return found;
  }
  return null;
}

function arrange(data: unknown) {
  requireUser.mockResolvedValue(MODERATOR);
  getUnreadCount.mockResolvedValue(0);
  backendJson.mockResolvedValue(data);
}

// source: Excel HTL-22 actor Hotel Moderator; ACC-11 "moderators may view bookings for their own hotel (HTL-22)";
// .md section 8 GET /api/hotels/:id/reservations (HTL-22); .md section 3 "Manages exactly one assigned hotel"
test("only hotel moderators load the page, and it asks for the reservations of their own hotel", async () => {
  arrange({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });

  render(await resolve(await Page({ searchParams: Promise.resolve({}) })));

  expect(requireUser).toHaveBeenCalledWith(["hotel_moderator"]);
  expect(backendJson).toHaveBeenCalledTimes(1);
  const url = new URL(backendJson.mock.calls[0][0] as string, "http://x");
  expect(url.pathname).toBe("/api/hotels/h1/reservations");
});

// source: Excel HTL-22 "view reservations for their hotel (guest, dates, status)"
test("each reservation row shows the guest name", async () => {
  arrange({ items: [reservation("a1", "Mona Adel", "2027-03-15", "2027-03-18", "confirmed")], page: 1, pageSize: 10, total: 1, totalPages: 1 });

  render(await resolve(await Page({ searchParams: Promise.resolve({}) })));

  const rows = within(screen.getByRole("table")).getAllByRole("row");
  expect(rows).toHaveLength(2);
  expect(rows[1].textContent).toContain("Mona Adel");
});

// source: Excel HTL-22 "(guest, dates, status)": the stay dates are check-in and check-out (.md section 3 Hotel Bookings "stay dates")
test("each reservation row shows the check-in and check-out dates", async () => {
  arrange({ items: [reservation("a1", "Mona Adel", "2027-03-15", "2027-03-18", "confirmed")], page: 1, pageSize: 10, total: 1, totalPages: 1 });

  render(await resolve(await Page({ searchParams: Promise.resolve({}) })));

  const row = within(screen.getByRole("table")).getAllByRole("row")[1];
  expect(row.textContent).toContain(formatDay("2027-03-15"));
  expect(row.textContent).toContain(formatDay("2027-03-18"));
});

// source: Excel HTL-22 "(guest, dates, status)"; GEN-11 states Confirmed and Cancelled
test("each reservation row shows its own status", async () => {
  arrange({
    items: [
      reservation("a1", "Mona Adel", "2027-03-15", "2027-03-18", "confirmed"),
      reservation("b2", "Omar Ali", "2027-04-01", "2027-04-03", "cancelled"),
    ],
    page: 1, pageSize: 10, total: 2, totalPages: 1,
  });

  render(await resolve(await Page({ searchParams: Promise.resolve({}) })));

  const rows = within(screen.getByRole("table")).getAllByRole("row");
  expect(rows[1].textContent).toContain("Confirmed");
  expect(rows[1].textContent).not.toContain("Cancelled");
  expect(rows[2].textContent).toContain("Cancelled");
  expect(rows[2].textContent).not.toContain("Confirmed");
});

// source: Excel GEN-05 "paginate every list longer than 10 rows"; .md section "pagination"
test("the ?page in the URL is sent to the backend", async () => {
  arrange({ items: [reservation("a1", "Mona Adel", "2027-03-15", "2027-03-18", "confirmed")], page: 2, pageSize: 10, total: 11, totalPages: 2 });

  render(await resolve(await Page({ searchParams: Promise.resolve({ page: "2" }) })));

  const url = new URL(backendJson.mock.calls[0][0] as string, "http://x");
  expect(url.searchParams.get("page")).toBe("2");
});

// source: Excel GEN-05 "paginate every list longer than 10 rows (page size 10)"
test("a list of 11 reservations offers a way to reach page 2", async () => {
  const items = Array.from({ length: 10 }, (_, i) => reservation(`r${i}`, `Guest ${i}`, "2027-03-15", "2027-03-18", "confirmed"));
  arrange({ items, page: 1, pageSize: 10, total: 11, totalPages: 2 });

  render(await resolve(await Page({ searchParams: Promise.resolve({}) })));

  const nav = screen.getByRole("navigation", { name: "Pagination" });
  const hrefs = within(nav).getAllByRole("link").map((a) => new URL(a.getAttribute("href")!, "http://x"));
  expect(hrefs.some((u) => u.pathname === "/hotel/reservations" && u.searchParams.get("page") === "2")).toBe(true);
});

// source: Excel GEN-04 "friendly empty states when a list ... has no results"
test("a hotel without reservations shows an empty state instead of a table", async () => {
  arrange({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });

  render(await resolve(await Page({ searchParams: Promise.resolve({}) })));

  expect(screen.queryByRole("table")).toBeNull();
  const headings = screen.getAllByRole("heading").map((h) => h.textContent);
  expect(headings.some((t) => t && t !== "Reservations")).toBe(true);
});

// source: Excel GEN-16 "clear feedback ... loading ... states"
test("a loading indicator is shown while the reservations load", async () => {
  arrange({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });

  const fallback = findFallback(await Page({ searchParams: Promise.resolve({}) }));
  render(<>{fallback}</>);

  expect(screen.getByRole("status")).toBeTruthy();
});

// source: Excel GEN-16 "clear feedback ... error states"
test("a backend failure is not shown as an empty list", async () => {
  arrange(null);

  await expect(resolve(await Page({ searchParams: Promise.resolve({}) }))).rejects.toThrow();
});
