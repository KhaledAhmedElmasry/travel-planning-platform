// P-25 New itinerary server page (ITN-01, GEN-12). The page and its Suspense child are async server
// components; the session, the backend call and the shell are faked, the form is rendered for real.
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const backendJson = vi.hoisted(() => vi.fn());
const requireUser = vi.hoisted(() => vi.fn());
const getUnreadCount = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/backend", () => ({ backendJson }));
vi.mock("@/lib/server/session", () => ({ requireUser, getUnreadCount }));
vi.mock("@/components/layout/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
import Page from "./page";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = () => {};
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  backendJson.mockReset();
  requireUser.mockReset();
  getUnreadCount.mockReset();
});

const USER = { id: "u1", name: "Mona", email: "m@x.io", role: "user", mustChangePassword: false };

// Resolves the async server tree (Page -> AppShell -> ... -> async CreateForm) into plain elements.
async function resolve(node: unknown): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(resolve)) as Promise<ReactNode>;
  if (!node || typeof node !== "object" || !("type" in node)) return node as ReactNode;
  const el = node as { type: unknown; props: { children?: unknown } & Record<string, unknown> };
  if (typeof el.type === "function" && el.type.constructor.name === "AsyncFunction") {
    return resolve(await (el.type as (p: unknown) => Promise<unknown>)(el.props));
  }
  const children = el.props?.children === undefined ? undefined : await resolve(el.props.children);
  return { ...(node as object), props: { ...el.props, children } } as ReactNode;
}

// source: Excel ITN-01 actor "Registered User"; openapi POST /api/itineraries "Access: registered users (role user)";
// Excel GEN-12 / openapi GET /api/countries (paginated, predefined list)
test("only registered users load the page and every page of GET /api/countries is read", async () => {
  requireUser.mockResolvedValue(USER);
  getUnreadCount.mockResolvedValue(0);
  backendJson
    .mockResolvedValueOnce({ items: [{ code: "EG", name: "Egypt", currency: "EGP" }], page: 1, pageSize: 10, total: 2, totalPages: 2 })
    .mockResolvedValueOnce({ items: [{ code: "AE", name: "United Arab Emirates", currency: "AED" }], page: 2, pageSize: 10, total: 2, totalPages: 2 });

  render(await resolve(await Page()));

  expect(requireUser).toHaveBeenCalledWith(["user"]);
  expect(backendJson).toHaveBeenCalledTimes(2);
  expect(backendJson).toHaveBeenNthCalledWith(1, "/api/countries?page=1");
  expect(backendJson).toHaveBeenNthCalledWith(2, "/api/countries?page=2");
  expect(screen.getByRole("heading", { level: 1, name: "New itinerary" })).toBeTruthy();
});

// source: Excel ITN-01 "countries selected from a predefined list"; Mock Data UPDATED.xlsx Countries.csv (EG Egypt, AE United Arab Emirates)
test("the form offers the countries from the predefined list by name", async () => {
  requireUser.mockResolvedValue(USER);
  getUnreadCount.mockResolvedValue(0);
  backendJson.mockResolvedValueOnce({
    items: [
      { code: "EG", name: "Egypt", currency: "EGP" },
      { code: "AE", name: "United Arab Emirates", currency: "AED" },
    ],
    page: 1,
    pageSize: 10,
    total: 2,
    totalPages: 1,
  });

  render(await resolve(await Page()));

  fireEvent.click(screen.getByRole("button", { name: /^countries/i }));
  const options = await screen.findAllByRole("option");
  expect(options.map((o) => o.textContent?.trim())).toEqual(["Egypt", "United Arab Emirates"]);
});
