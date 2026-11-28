// P-36 Flights server page (FLT-30). The page is rendered directly (it is an async function);
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

import Page from "./page";

afterEach(() => {
  cleanup();
  backendJson.mockReset();
  requireUser.mockReset();
  getUnreadCount.mockReset();
});

const MODERATOR = { id: "m1", name: "Air Mod", email: "mod@x.io", role: "airline_moderator", airlineId: "a1", mustChangePassword: false };

const flight = (id: string, status: string) => ({
  id,
  flightNumber: `DA${id}`,
  departureAirport: "CAI",
  arrivalAirport: "DXB",
  departureTimeZone: "Africa/Cairo",
  arrivalTimeZone: "Asia/Dubai",
  departureAt: "2027-03-01T08:00:00.000Z",
  arrivalAt: "2027-03-01T12:00:00.000Z",
  status,
  hasBookings: false,
  currency: "USD",
});

// Finds the <Suspense> child (the async table) in the page tree without calling client components
function suspenseChild(node: ReactNode): ReactElement | null {
  if (!isValidElement(node)) return null;
  const el = node as ReactElement<{ children?: ReactNode }>;
  if (el.type === Suspense) return el.props.children as ReactElement;
  const kids = el.props.children;
  for (const kid of Array.isArray(kids) ? kids : [kids]) {
    const found = suspenseChild(kid);
    if (found) return found;
  }
  return null;
}

async function renderPage(searchParams: Record<string, string>, data: unknown) {
  requireUser.mockResolvedValue(MODERATOR);
  getUnreadCount.mockResolvedValue(0);
  backendJson.mockResolvedValue(data);
  const tree = await Page({ searchParams: Promise.resolve(searchParams) });
  const table = suspenseChild(tree);
  if (!table) throw new Error("no table in the page");
  render(await (table.type as (p: unknown) => Promise<ReactNode>)(table.props));
}

const page2 = (items = [flight("1", "scheduled")]) => ({ items, page: 2, pageSize: 10, total: 12, totalPages: 2 });

// source: Excel GEN-05 "The system shall paginate every list longer than 10 rows (page size 10)":
// from page 2 the links back must lead to page 1 of this list, not stay on page 2
test("on page 2 without filters, Previous and 1 lead to the first page of /airline/flights", async () => {
  await renderPage({ page: "2" }, page2());

  // an <a> with an empty href is not exposed as a link, so look the anchors up by label and text
  expect(screen.getByLabelText("Previous page").getAttribute("href")).toBe("/airline/flights");
  expect(screen.getByText("1", { selector: "a" }).getAttribute("href")).toBe("/airline/flights");
});

// source: Excel GEN-05 (page size 10, every list paginated); .md section "filtering, sorting, and pagination":
// paging a filtered list must stay on the same filtered list
test("pagination links keep the status and date filters", async () => {
  await renderPage({ page: "2", status: "departed", from: "2027-03-01", to: "2027-03-31" }, page2([flight("1", "departed")]));

  expect(screen.getByLabelText("Previous page").getAttribute("href")).toBe(
    "/airline/flights?status=departed&from=2027-03-01&to=2027-03-31",
  );
  const query = new URLSearchParams(backendJson.mock.calls[0][0].split("?")[1]);
  expect(Object.fromEntries(query)).toEqual({ page: "2", status: "departed", from: "2027-03-01", to: "2027-03-31" });
});

// source: .md section 3 roles table "Airline Moderator | Manages exactly one assigned airline, including its ... flights"
test("only airline moderators load the page, and it asks for the flights of their own airline", async () => {
  await renderPage({}, { items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });

  expect(requireUser).toHaveBeenCalledWith(["airline_moderator"]);
  expect(backendJson).toHaveBeenCalledTimes(1);
  expect(backendJson.mock.calls[0][0]).toMatch(/^\/api\/airlines\/a1\/flights\?/);
});

// source: Excel FLT-30 "Flights shall have a status of Scheduled, Cancelled or Departed"
test("each flight shows its status as Scheduled, Cancelled or Departed", async () => {
  await renderPage({}, {
    items: [flight("1", "scheduled"), flight("2", "cancelled"), flight("3", "departed")],
    page: 1,
    pageSize: 10,
    total: 3,
    totalPages: 1,
  });

  for (const label of ["Scheduled", "Cancelled", "Departed"]) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
});

// source: Excel FLT-30: only the three statuses exist, so another status is refused before any backend call
test("an unknown status filter loads nothing from the backend", async () => {
  requireUser.mockResolvedValue(MODERATOR);
  getUnreadCount.mockResolvedValue(0);

  const tree = await Page({ searchParams: Promise.resolve({ status: "boarding" }) });

  expect(suspenseChild(tree)).toBeNull();
  expect(backendJson).not.toHaveBeenCalled();
});
