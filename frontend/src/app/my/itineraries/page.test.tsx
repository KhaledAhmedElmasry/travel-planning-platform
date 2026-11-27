// P-24 My itineraries server page (ITN-03). The page is rendered directly (it is an async function);
// the session, the backend calls and the shell are faked.
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";

const backendJson = vi.hoisted(() => vi.fn());
const requireUser = vi.hoisted(() => vi.fn());
const getUnreadCount = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/backend", () => ({ backendJson }));
vi.mock("@/lib/server/session", () => ({ requireUser, getUnreadCount }));
vi.mock("@/components/layout/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

import Page from "./page";

afterEach(() => {
  cleanup();
  backendJson.mockReset();
  requireUser.mockReset();
  getUnreadCount.mockReset();
});

const USER = { id: "u1", name: "Mona", email: "m@x.io", role: "user", mustChangePassword: false };
const COUNTRIES = { items: [{ code: "EG", name: "Egypt" }, { code: "AE", name: "United Arab Emirates" }], page: 1, pageSize: 10, total: 2, totalPages: 1 };
// openapi ItinerarySummary
const NEWER = { id: "it-new", title: "Cairo and Dubai", countryCodes: ["EG", "AE"], startDate: "2027-03-01", numberOfDays: 3, visibility: "public" };
const OLDER = { id: "it-old", title: "Nile week", countryCodes: ["EG"], startDate: "2027-04-10", numberOfDays: 1, visibility: "private" };

function backendWith(list: unknown) {
  requireUser.mockResolvedValue(USER);
  getUnreadCount.mockResolvedValue(0);
  backendJson.mockImplementation(async (path: string) => (path.startsWith("/api/countries") ? COUNTRIES : list));
}

const hrefs = () => screen.queryAllByRole("link").map((a) => a.getAttribute("href"));

// source: openapi GET /api/itineraries "List own itineraries (ITN-03)", Page param; Excel ITN-03 actor "Registered User"
test("only registered users load the page, and the ?page in the URL is sent to GET /api/itineraries", async () => {
  backendWith({ items: [], page: 2, pageSize: 10, total: 12, totalPages: 2 });

  render(await Page({ searchParams: Promise.resolve({ page: "2" }) }));

  expect(requireUser).toHaveBeenCalledWith(["user"]);
  expect(backendJson).toHaveBeenCalledWith("/api/itineraries?page=2");
  expect(screen.getByRole("heading", { level: 1, name: "My itineraries" })).toBeTruthy();
});

// source: openapi Page parameter (page >= 1, default 1)
test("a page number that is not a positive whole number asks for page 1", async () => {
  backendWith({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });

  render(await Page({ searchParams: Promise.resolve({ page: "abc" }) }));

  expect(backendJson).toHaveBeenCalledWith("/api/itineraries?page=1");
});

// source: Excel ITN-03 "list their itineraries (title, countries, start date, days and visibility), most recently
// updated first, and open any itinerary"; handout T1 P-24 (full country names from GET /api/countries, links to /my/itineraries/[id])
test("each itinerary shows its title, full country names, days and visibility, in the backend's order, and opens its page", async () => {
  backendWith({ items: [NEWER, OLDER], page: 1, pageSize: 10, total: 2, totalPages: 1 });

  render(await Page({ searchParams: Promise.resolve({}) }));

  const cards = screen.getAllByRole("article");
  expect(cards.map((c) => within(c).getByRole("heading").textContent)).toEqual(["Cairo and Dubai", "Nile week"]);
  expect(within(cards[0]).getByRole("link", { name: "Cairo and Dubai" }).getAttribute("href")).toBe("/my/itineraries/it-new");
  expect(within(cards[1]).getByRole("link", { name: "Nile week" }).getAttribute("href")).toBe("/my/itineraries/it-old");
  expect(within(cards[0]).getByText("Egypt, United Arab Emirates")).toBeTruthy();
  expect(within(cards[0]).getByText(/^3 days?$/)).toBeTruthy();
  expect(within(cards[0]).getByText(/public/i)).toBeTruthy();
  expect(within(cards[1]).getByText(/private/i)).toBeTruthy();
  expect(backendJson).toHaveBeenCalledWith("/api/countries?page=1");
});

// source: Excel GEN-05 "paginate every list longer than 10 rows (page size 10)"
test("more than 10 itineraries show a page bar linking to page 2", async () => {
  backendWith({ items: [NEWER, OLDER], page: 1, pageSize: 10, total: 12, totalPages: 2 });

  render(await Page({ searchParams: Promise.resolve({}) }));

  expect(hrefs()).toContain("/my/itineraries?page=2");
});

// source: Excel GEN-04 friendly empty states; spec section 5 empty lists "So empty! Let's plan something."; handout T1 P-24 links to /my/itineraries/new
test("a user with no itineraries sees the empty state with a link to create one", async () => {
  backendWith({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });

  render(await Page({ searchParams: Promise.resolve({}) }));

  expect(screen.queryAllByRole("article")).toHaveLength(0);
  expect(screen.getByText(/So empty! Let's plan something\./)).toBeTruthy();
  expect(hrefs()).toContain("/my/itineraries/new");
});

// source: Khaled's P-33 decision 26 Nov (a page past the end links back to page 1); Excel GEN-04
test("a page past the last one shows no cards and links back to page 1", async () => {
  backendWith({ items: [], page: 99, pageSize: 10, total: 2, totalPages: 1 });

  render(await Page({ searchParams: Promise.resolve({ page: "99" }) }));

  expect(screen.queryAllByRole("article")).toHaveLength(0);
  expect(screen.queryByText(/So empty! Let's plan something\./)).toBeNull();
  expect(hrefs()).toContain("/my/itineraries");
});
