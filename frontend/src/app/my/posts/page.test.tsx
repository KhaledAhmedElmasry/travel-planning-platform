// P-33 My posts server page (BLG-03). The page is rendered directly (it is an async function);
// the session, the backend call and the shell are faked.
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";

const backendJson = vi.hoisted(() => vi.fn());
const requireUser = vi.hoisted(() => vi.fn());
const getUnreadCount = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/backend", () => ({ backendJson }));
vi.mock("@/lib/server/session", () => ({ requireUser, getUnreadCount }));
vi.mock("@/components/layout/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

import Page from "./page";

afterEach(() => {
  cleanup();
  backendJson.mockReset();
  requireUser.mockReset();
  getUnreadCount.mockReset();
});

const USER = { id: "u1", name: "Mona", email: "m@x.io", role: "user", mustChangePassword: false };

// source: openapi GET /api/posts/mine "Access: registered users", Page param; handout T2 "Server pages call requireUser([...roles])"
test("only registered users load the page, and the ?page in the URL is sent to GET /api/posts/mine", async () => {
  requireUser.mockResolvedValue(USER);
  getUnreadCount.mockResolvedValue(0);
  backendJson.mockResolvedValue({ items: [], page: 2, pageSize: 10, total: 12, totalPages: 2 });

  render(await Page({ searchParams: Promise.resolve({ page: "2" }) }));

  expect(requireUser).toHaveBeenCalledWith(["user"]);
  expect(backendJson).toHaveBeenCalledWith("/api/posts/mine?page=2");
  expect(screen.getByRole("heading", { level: 1, name: "My posts" })).toBeTruthy();
});

// source: handout T2 "P-33 links to T4's /my/posts/new" (plain link)
test("the page links to writing a new post", async () => {
  requireUser.mockResolvedValue(USER);
  getUnreadCount.mockResolvedValue(0);
  backendJson.mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });

  render(await Page({ searchParams: Promise.resolve({}) }));

  const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
  expect(hrefs).toContain("/my/posts/new");
});
