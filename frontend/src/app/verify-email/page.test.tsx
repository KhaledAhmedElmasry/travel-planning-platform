// P-08 Verify email (ACC-02 bonus). The server page is rendered directly (it is an async function);
// only the backend call and the session lookup are faked.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const backendFetch = vi.hoisted(() => vi.fn());
const getSessionUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/backend", () => ({ backendFetch }));
vi.mock("@/lib/server/session", () => ({ getSessionUser }));

import Page, { metadata } from "./page";

afterEach(() => {
  cleanup();
  backendFetch.mockReset();
  getSessionUser.mockReset();
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const INVALID = { statusCode: 400, error: "BAD_REQUEST", message: "The token is invalid, expired or already used." };

async function renderPage(query: Record<string, string | string[] | undefined>) {
  render(await Page({ searchParams: Promise.resolve(query) }));
}

// source: openapi GET /api/auth/verify-email - the emailed link opens /verify-email?token=..., which calls this
// endpoint and shows the result; team leader (24 Nov, Q1A): checked on the server when the page loads
test("a guest opening a valid link is verified and is offered to log in", async () => {
  backendFetch.mockResolvedValue(jsonResponse(200, { message: "Email verified. You can now book flights and hotels" }));
  getSessionUser.mockResolvedValue(null);

  await renderPage({ token: "abc+/=" });

  expect(backendFetch).toHaveBeenCalledWith("/api/auth/verify-email?token=abc%2B%2F%3D");
  expect(screen.getByRole("heading", { level: 1, name: "Email verified" })).toBeTruthy();
  expect(screen.getByText("Email verified. You can now book flights and hotels")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Log in" }).getAttribute("href")).toBe("/login");
});

// source: team leader (24 Nov, Q5A) - "Go to home" when logged in (role home, ACC-04)
test("a logged-in traveler who verifies is offered to go to the home page", async () => {
  backendFetch.mockResolvedValue(jsonResponse(200, { message: "Email verified. You can now book flights and hotels" }));
  getSessionUser.mockResolvedValue({ id: "u1", name: "Mona", email: "m@x.io", role: "user", mustChangePassword: false });

  await renderPage({ token: "abc" });

  expect(screen.getByRole("link", { name: "Go to home" }).getAttribute("href")).toBe("/home");
  expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
});

// source: spec P-08 "states success, expired or invalid link"; openapi 400 = one message for invalid, expired or used;
// team leader (24 Nov, Q2A + Q3A): one failure state with the backend message + "If you already verified, you can log in."
test("an invalid, expired or used link shows the backend message and the already-verified hint", async () => {
  backendFetch.mockResolvedValue(jsonResponse(400, INVALID));
  getSessionUser.mockResolvedValue(null);

  await renderPage({ token: "used" });

  expect(screen.getByRole("heading", { level: 1, name: "Link not valid" })).toBeTruthy();
  expect(screen.getByText("The token is invalid, expired or already used.")).toBeTruthy();
  expect(screen.getByText("If you already verified, you can log in.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Log in" }).getAttribute("href")).toBe("/login");
  expect(screen.queryByText(/Email verified/)).toBeNull();
});

// source: team leader (24 Nov, follow-up 2) - logged-in visitors: "If you already verified, you can ignore this link."
test("a logged-in visitor with a used link is told to ignore it and offered the home page", async () => {
  backendFetch.mockResolvedValue(jsonResponse(400, INVALID));
  getSessionUser.mockResolvedValue({ id: "u1", name: "Mona", email: "m@x.io", role: "user", mustChangePassword: false });

  await renderPage({ token: "used" });

  expect(screen.getByText("If you already verified, you can ignore this link.")).toBeTruthy();
  expect(screen.queryByText("If you already verified, you can log in.")).toBeNull();
  expect(screen.getByRole("link", { name: "Go to home" }).getAttribute("href")).toBe("/home");
});

// source: team leader (24 Nov, Q6A) - no token: the invalid-link state, without calling the backend
test.each([[{}], [{ token: "" }], [{ token: ["a", "b"] }]])("a link without one token (%j) is invalid and the backend is not called", async (query) => {
  getSessionUser.mockResolvedValue(null);

  await renderPage(query);

  expect(backendFetch).not.toHaveBeenCalled();
  expect(screen.getByRole("heading", { level: 1, name: "Link not valid" })).toBeTruthy();
  expect(screen.getByText("If you already verified, you can log in.")).toBeTruthy();
});

// source: spec line 462 - error state; src/app/error.tsx shows the retry page for unexpected failures
test("an unexpected backend failure is not shown as an invalid link", async () => {
  backendFetch.mockResolvedValue(jsonResponse(500, { statusCode: 500, message: "boom" }));
  getSessionUser.mockResolvedValue(null);

  await expect(Page({ searchParams: Promise.resolve({ token: "abc" }) })).rejects.toThrow();
});

// source: team leader (24 Nov, Q21A) - plain title, never indexed (token page)
test("the page has a plain title and is not indexed", () => {
  expect(metadata.title).toBe("Verify email");
  expect(metadata.robots).toEqual({ index: false, follow: false });
});
