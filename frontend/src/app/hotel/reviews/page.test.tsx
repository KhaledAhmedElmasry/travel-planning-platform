// Hotel moderator reviews page (HTL-26, HTL-24, GEN-04, GEN-05). The page is rendered directly (it is an
// async function); the session, the backend call and the shell are faked.
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
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import Page from "./page";

afterEach(() => {
  cleanup();
  backendJson.mockReset();
  requireUser.mockReset();
  getUnreadCount.mockReset();
});

const MODERATOR = { id: "m1", name: "Desk", email: "desk@x.io", role: "hotel_moderator", hotelId: "h1", mustChangePassword: false };

function review(id: string, text: string, reply: { text: string; date: string } | null = null) {
  return { id, rating: 4, text, author: { name: "Guest" }, date: "2027-03-06T10:00:00.000Z", reply, hidden: false };
}
function pageOf(items: unknown[], extra: Record<string, unknown> = {}) {
  return { items, page: 1, pageSize: 10, total: items.length, totalPages: items.length ? 1 : 0, averageRating: 4.5, ratingCount: 7, ...extra };
}
async function renderPage(page?: string) {
  requireUser.mockResolvedValue(MODERATOR);
  getUnreadCount.mockResolvedValue(0);
  render(await resolve(await Page({ searchParams: Promise.resolve(page ? { page } : {}) })));
}
// Vitest cannot render the async child inside <Suspense>: find it and await it directly
async function resolve(node: ReactNode): Promise<ReactNode> {
  if (!isValidElement(node)) return node;
  const el = node as ReactElement<{ children?: ReactNode }>;
  if (el.type === Suspense) {
    const child = el.props.children as ReactElement;
    return (child.type as (p: unknown) => Promise<ReactNode>)(child.props);
  }
  const kids = el.props.children;
  if (kids === undefined) return el;
  const resolved = await Promise.all((Array.isArray(kids) ? kids : [kids]).map(resolve));
  return { ...el, props: { ...el.props, children: resolved } };
}

// source: Excel Bonus HTL-26 actor "Hotel Moderator"
test("only hotel moderators load the page", async () => {
  backendJson.mockResolvedValue(pageOf([]));
  await renderPage();
  expect(requireUser).toHaveBeenCalledWith(["hotel_moderator"]);
});

// source: Project description 8.6 "GET /api/hotels/:id/reviews HTL-24"; Excel GEN-05 (paginated, ?page kept)
test("the reviews of the moderator's own hotel are loaded for the page in the URL", async () => {
  backendJson.mockResolvedValue(pageOf([], { page: 2, total: 12, totalPages: 2 }));
  await renderPage("2");
  await screen.findByRole("heading", { level: 1 });
  expect(backendJson).toHaveBeenCalledWith("/api/hotels/h1/reviews?page=2");
});

// source: Excel HTL-24 "view a hotel's average rating, number of ratings and reviews"
test("the hotel's average rating is shown", async () => {
  backendJson.mockResolvedValue(pageOf([review("r1", "Lovely stay.")]));
  await renderPage();
  expect(await screen.findByRole("img", { name: "Rated 4.5 out of 5" })).toBeDefined();
});

// source: Excel HTL-24 "number of ratings"
test("the number of ratings is shown", async () => {
  backendJson.mockResolvedValue(pageOf([review("r1", "Lovely stay.")]));
  await renderPage();
  expect(await screen.findByText(/\b7\b.*rating/i)).toBeDefined();
});

// source: Excel HTL-24 "reviews" listed
test("every review of the page is listed with its text", async () => {
  backendJson.mockResolvedValue(pageOf([review("r1", "Lovely stay."), review("r2", "Noisy street.")]));
  await renderPage();
  expect(await screen.findByText("Lovely stay.")).toBeDefined();
  expect(screen.getByText("Noisy street.")).toBeDefined();
});

// source: Excel Bonus HTL-26 "allow a hotel moderator to reply to a review"
test("a review without a reply offers the moderator a Reply button", async () => {
  backendJson.mockResolvedValue(pageOf([review("r1", "Lovely stay.")]));
  await renderPage();
  expect(await screen.findByRole("button", { name: "Reply" })).toBeDefined();
});

// source: Excel GEN-04 "friendly empty states when a list ... has no results"
test("a hotel with no reviews shows an empty state instead of a list", async () => {
  backendJson.mockResolvedValue(pageOf([]));
  await renderPage();
  await screen.findByRole("heading", { level: 1 });
  expect(await screen.findByRole("heading", { level: 2 })).toBeDefined();
  expect(screen.queryByRole("list")).toBeNull();
  expect(screen.queryByRole("button", { name: "Reply" })).toBeNull();
});

// source: Excel GEN-05 "paginate every list longer than 10 rows (page size 10)"
test("12 reviews are split into pages with a link to page 2", async () => {
  const items = Array.from({ length: 10 }, (_, i) => review(`r${i}`, `Review ${i}`));
  backendJson.mockResolvedValue(pageOf(items, { total: 12, totalPages: 2 }));
  await renderPage();
  const nav = await screen.findByRole("navigation", { name: "Pagination" });
  const hrefs = [...nav.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  expect(hrefs).toContain("/hotel/reviews?page=2");
});

// source: Excel GEN-05 - only lists longer than 10 rows are paginated
test("3 reviews show no pagination", async () => {
  backendJson.mockResolvedValue(pageOf([review("r1", "A"), review("r2", "B"), review("r3", "C")]));
  await renderPage();
  await screen.findByText("A");
  expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
});
