// Header bell (GEN-01): unread badge, and a dropdown with the latest notifications (one page of
// GET /api/notifications), "Mark as read" per item and a "See all" link to /notifications
// (team leader, 24 Nov, decision 1). Only fetch is faked.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { NotificationBellView } from "./notification-bell";
import type { AppNotification } from "@/components/app/shared/notification-item";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
// source: backend pagination.dto.ts paginate() - { items, page, pageSize, total, totalPages }
const page = (items: AppNotification[]) => ({ items, page: 1, pageSize: 10, total: items.length, totalPages: 1 });

// source: Excel GEN-01 - unread count; spec 3.2 "Bell ... with an unread count badge"
test("the badge shows the unread count and the button says it", () => {
  const { rerender } = render(<NotificationBellView unread={3} navigate={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Notifications, 3 unread" }).textContent).toContain("3");

  rerender(<NotificationBellView unread={0} navigate={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Notifications" }).textContent).toBe("");

  rerender(<NotificationBellView unread={120} navigate={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Notifications, 120 unread" }).textContent).toContain("99+");
});

// source: team leader decision 1 (24 Nov) - dropdown with one page of GET /api/notifications (GEN-05 page size 10) + "See all"
test("opening the bell loads the first page of notifications and links to the full page", async () => {
  const fetchMock = vi.fn().mockResolvedValue(json(200, page([n("a", false), n("b", true)])));
  vi.stubGlobal("fetch", fetchMock);
  render(<NotificationBellView unread={1} navigate={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "Notifications, 1 unread" }));

  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByText("Title a");
  expect(within(dialog).getAllByRole("listitem")).toHaveLength(2);
  expect(fetchMock.mock.calls[0][0]).toBe("/api/notifications?page=1");
  expect(within(dialog).getByRole("link", { name: "See all" }).getAttribute("href")).toBe("/notifications");
});

// source: team leader decision 1 (24 Nov) - "Mark as read" in the dropdown; the badge follows (GEN-01 unread count)
test("marking one as read in the dropdown lowers the badge", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(json(200, page([n("a", false), n("b", false)])))
    .mockResolvedValueOnce(json(200, { ...n("a", true) }));
  vi.stubGlobal("fetch", fetchMock);
  render(<NotificationBellView unread={2} navigate={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "Notifications, 2 unread" }));
  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByText("Title a");
  fireEvent.click(within(dialog).getAllByRole("button", { name: "Mark as read" })[0]);

  await waitFor(() => expect(within(dialog).getAllByRole("button", { name: "Mark as read" })).toHaveLength(1));
  expect(fetchMock.mock.calls[1][0]).toBe("/api/notifications/a/read");
  expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeTruthy();
});

// source: spec 3.2 "Empty state"; Excel GEN-04 friendly empty states
test("no notifications shows the empty state", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(200, page([]))));
  render(<NotificationBellView unread={0} navigate={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

  const dialog = await screen.findByRole("dialog");
  expect(await within(dialog).findByText("No notifications yet")).toBeTruthy();
});

// source: Excel GEN-16 - error feedback with a recovery option
test("a failed load shows an error with Try again, which loads again", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(json(500, { statusCode: 500, error: "INTERNAL", message: "Internal server error" }))
    .mockResolvedValueOnce(json(200, page([n("a", true)])));
  vi.stubGlobal("fetch", fetchMock);
  render(<NotificationBellView unread={0} navigate={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(await within(dialog).findByRole("button", { name: "Try again" }));

  expect(await within(dialog).findByText("Title a")).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
