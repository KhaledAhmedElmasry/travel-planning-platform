// P-11 notifications list (GEN-01): the page's items, "Mark as read" per item, "Mark all as read"
// (PATCH /api/notifications/read-all) and the empty state. Only fetch and the toast are faked.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { NotificationsList } from "./notifications-list";
import type { AppNotification } from "@/components/app/shared/notification-item";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toast.success.mockReset();
  toast.error.mockReset();
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const n = (id: string, read: boolean): AppNotification => ({
  id,
  userId: "u1",
  title: `Title ${id}`,
  message: `Message ${id}`,
  type: "general",
  read,
  createdAt: "2026-11-24T10:00:00.000Z",
});

// source: Excel GEN-01 - notification list
test("lists the notifications of this page", () => {
  render(<NotificationsList items={[n("a", false), n("b", true)]} unread={1} navigate={vi.fn()} refresh={vi.fn()} />);

  expect(screen.getAllByRole("listitem").map((li) => li.querySelector("span.font-semibold")?.textContent)).toEqual([
    "UnreadTitle a",
    "Title b",
  ]);
});

// source: spec 3.2 "Empty state"; Excel GEN-04
test("no notifications shows the empty state and no Mark all button", () => {
  render(<NotificationsList items={[]} unread={0} navigate={vi.fn()} refresh={vi.fn()} />);

  expect(screen.getByText("No notifications yet")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Mark all as read" })).toBeNull();
});

// source: spec 3.2 "Mark all as read" button; openapi PATCH /api/notifications/read-all
test("Mark all as read calls read-all, shows every item as read and refreshes the page (badge)", async () => {
  const fetchMock = vi.fn().mockResolvedValue(json(200, { message: "All notifications marked as read", count: 2 }));
  vi.stubGlobal("fetch", fetchMock);
  const refresh = vi.fn();
  render(<NotificationsList items={[n("a", false), n("b", false)]} unread={2} navigate={vi.fn()} refresh={refresh} />);

  fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));

  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/notifications/read-all");
  expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
  expect(screen.queryByText("Unread")).toBeNull();
  expect(screen.queryByRole("button", { name: "Mark as read" })).toBeNull();
  expect(toast.success).toHaveBeenCalledWith("All notifications marked as read");
});

// source: Excel GEN-01 unread count - nothing unread, nothing to mark
test("Mark all as read is disabled when nothing is unread", () => {
  render(<NotificationsList items={[n("a", true)]} unread={0} navigate={vi.fn()} refresh={vi.fn()} />);

  expect((screen.getByRole("button", { name: "Mark all as read" }) as HTMLButtonElement).disabled).toBe(true);
});

// source: Excel GEN-01 - mark as read (one item)
test("marking one item as read updates only that item", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(200, n("a", true))));
  const refresh = vi.fn();
  render(<NotificationsList items={[n("a", false), n("b", false)]} unread={2} navigate={vi.fn()} refresh={refresh} />);

  fireEvent.click(screen.getAllByRole("button", { name: "Mark as read" })[0]);

  await waitFor(() => expect(screen.getAllByRole("button", { name: "Mark as read" })).toHaveLength(1));
  expect(screen.getAllByText("Unread")).toHaveLength(1);
  expect(refresh).toHaveBeenCalledTimes(1);
});

// source: Excel GEN-16 - error feedback
test("a failed Mark all shows the backend's message and keeps the items unread", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(500, { statusCode: 500, error: "INTERNAL", message: "Internal server error" })));
  render(<NotificationsList items={[n("a", false)]} unread={1} navigate={vi.fn()} refresh={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Internal server error"));
  expect(screen.getByText("Unread")).toBeTruthy();
});
