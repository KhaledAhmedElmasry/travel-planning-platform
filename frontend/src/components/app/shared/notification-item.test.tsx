// NotificationItem (GEN-01): one notification, read/unread, "Mark as read", and a click that marks it
// read and opens its link (team leader, 24 Nov, decision 2). Only fetch and the toast are faked.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { NotificationItem, type AppNotification } from "./notification-item";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toast.error.mockReset();
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// source: backend notifications.service.ts NotificationItem (GET /api/notifications items)
const unread: AppNotification = {
  id: "n1",
  userId: "u1",
  title: "Booking confirmed",
  message: "Your flight booking YW4K9P is confirmed.",
  type: "general",
  read: false,
  link: "/bookings/flights/b1",
  createdAt: "2026-11-24T10:00:00.000Z",
};

// source: Excel GEN-01 - notification list (booking confirmation...)
test("shows the title, the message and the date", () => {
  render(<NotificationItem notification={unread} onRead={vi.fn()} navigate={vi.fn()} />);

  const item = screen.getByRole("listitem");
  expect(item.textContent).toContain("Booking confirmed");
  expect(item.textContent).toContain("Your flight booking YW4K9P is confirmed.");
  expect(item.textContent).toContain("24 Nov 2026");
});

// source: Excel GEN-01 - unread count / mark as read; spec 6 "Notification item (read/unread, mark as read)"
test("an unread notification says so and has a Mark as read button; a read one has neither", () => {
  const { rerender } = render(<NotificationItem notification={unread} onRead={vi.fn()} navigate={vi.fn()} />);
  expect(screen.getByText("Unread")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Mark as read" })).toBeTruthy();

  rerender(<NotificationItem notification={{ ...unread, read: true }} onRead={vi.fn()} navigate={vi.fn()} />);
  expect(screen.queryByText("Unread")).toBeNull();
  expect(screen.queryByRole("button", { name: "Mark as read" })).toBeNull();
});

// source: Excel GEN-01 - mark as read; openapi PATCH /api/notifications/{id}/read
test("Mark as read calls PATCH /api/notifications/{id}/read and reports the saved notification, without navigating", async () => {
  const saved = { ...unread, read: true, readAt: "2026-11-24T11:00:00.000Z" };
  const fetchMock = vi.fn().mockResolvedValue(json(200, saved));
  vi.stubGlobal("fetch", fetchMock);
  const onRead = vi.fn();
  const navigate = vi.fn();
  render(<NotificationItem notification={unread} onRead={onRead} navigate={navigate} />);

  fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));

  await waitFor(() => expect(onRead).toHaveBeenCalledWith(saved));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe("/api/notifications/n1/read");
  expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
  expect(navigate).not.toHaveBeenCalled();
});

// source: team leader decision 2 (24 Nov) - clicking an item marks it read AND opens its link
test("clicking an unread notification marks it read, then opens its link", async () => {
  const saved = { ...unread, read: true };
  const fetchMock = vi.fn().mockResolvedValue(json(200, saved));
  vi.stubGlobal("fetch", fetchMock);
  const onRead = vi.fn();
  const navigate = vi.fn();
  render(<NotificationItem notification={unread} onRead={onRead} navigate={navigate} />);

  fireEvent.click(screen.getByRole("button", { name: /Booking confirmed/ }));

  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/bookings/flights/b1"));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/notifications/n1/read");
  expect(onRead).toHaveBeenCalledWith(saved);
});

// source: team leader decision 2 (24 Nov) - a notification without a link is only marked read
test("clicking an unread notification without a link only marks it read", async () => {
  const noLink = { ...unread, link: undefined };
  const fetchMock = vi.fn().mockResolvedValue(json(200, { ...noLink, read: true }));
  vi.stubGlobal("fetch", fetchMock);
  const onRead = vi.fn();
  const navigate = vi.fn();
  render(<NotificationItem notification={noLink} onRead={onRead} navigate={navigate} />);

  fireEvent.click(screen.getByRole("button", { name: /Booking confirmed/ }));

  await waitFor(() => expect(onRead).toHaveBeenCalledTimes(1));
  expect(navigate).not.toHaveBeenCalled();
});

// source: team leader decision 2 (24 Nov) - an item already read is not marked again, the link still opens
test("clicking a read notification opens its link without calling the backend", () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const navigate = vi.fn();
  render(<NotificationItem notification={{ ...unread, read: true }} onRead={vi.fn()} navigate={navigate} />);

  fireEvent.click(screen.getByRole("button", { name: /Booking confirmed/ }));

  expect(navigate).toHaveBeenCalledWith("/bookings/flights/b1");
  expect(fetchMock).not.toHaveBeenCalled();
});

// source: Excel GEN-13 (security; no open redirect) - only links on this site are followed
test("a link outside the site is never followed", () => {
  const navigate = vi.fn();
  render(<NotificationItem notification={{ ...unread, read: true, link: "https://evil.example/x" }} onRead={vi.fn()} navigate={navigate} />);

  fireEvent.click(screen.getByRole("button", { name: /Booking confirmed/ }));

  expect(navigate).not.toHaveBeenCalled();
});

// source: Excel GEN-16 - clear error feedback on every action
test("when marking fails, the backend's message is shown and the item stays unread", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(404, { statusCode: 404, error: "NOT_FOUND", message: "Notification not found" })));
  const onRead = vi.fn();
  render(<NotificationItem notification={unread} onRead={onRead} navigate={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Notification not found"));
  expect(onRead).not.toHaveBeenCalled();
});
