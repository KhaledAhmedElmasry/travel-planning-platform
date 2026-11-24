// AdminContentActions (GEN-10): an admin hides (confirm + optional reason), unhides, or deletes
// (confirm, GEN-03) a post, comment, review or itinerary. Team leader decision 3 (24 Nov).
// Only fetch and the toast are faked.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { AdminContentActions } from "./admin-content-actions";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toast.success.mockReset();
  toast.error.mockReset();
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function dialogButton(dialog: HTMLElement, name: string) {
  return within(dialog).getAllByRole("button").find((b) => b.textContent === name)!;
}

// source: Excel GEN-10 - hide or delete any post, comment, review or itinerary; spec 3.11 P-52 Unhide on hidden content
test("visible content offers Hide and Delete; hidden content offers Unhide and Delete", () => {
  const { rerender } = render(<AdminContentActions type="post" id="p1" hidden={false} />);
  expect(screen.getByRole("button", { name: "Hide" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Unhide" })).toBeNull();

  rerender(<AdminContentActions type="post" id="p1" hidden />);
  expect(screen.getByRole("button", { name: "Unhide" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Hide" })).toBeNull();
});

// source: team leader decision 3 (24 Nov) - Hide: confirm dialog with an OPTIONAL reason; Excel GEN-10 visible only to author and admins
test("Hide asks first, with an optional reason, and sends nothing when no reason is typed", async () => {
  const fetchMock = vi.fn().mockResolvedValue(json(200, { id: "p1", hidden: true }));
  vi.stubGlobal("fetch", fetchMock);
  const onHiddenChange = vi.fn();
  render(<AdminContentActions type="post" id="p1" hidden={false} onHiddenChange={onHiddenChange} />);

  fireEvent.click(screen.getByRole("button", { name: "Hide" }));
  const dialog = await screen.findByRole("dialog");
  expect(dialog.textContent).toContain("Only its author and admins will see it.");
  expect(within(dialog).getByRole("textbox", { name: /Reason/ })).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();

  fireEvent.click(dialogButton(dialog, "Hide post"));

  await waitFor(() => expect(onHiddenChange).toHaveBeenCalledWith(true));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/content/post/p1/hide");
  expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({});
  expect(screen.getByRole("button", { name: "Unhide" })).toBeTruthy();
});

// source: openapi PATCH /api/admin/content/{type}/{id}/hide body { reason? } (max 500, hide-content.dto.ts)
test("a typed reason is sent trimmed", async () => {
  const fetchMock = vi.fn().mockResolvedValue(json(200, {}));
  vi.stubGlobal("fetch", fetchMock);
  render(<AdminContentActions type="comment" id="c9" hidden={false} />);

  fireEvent.click(screen.getByRole("button", { name: "Hide" }));
  const dialog = await screen.findByRole("dialog");
  const reason = within(dialog).getByRole("textbox", { name: /Reason/ }) as HTMLTextAreaElement;
  expect(reason.maxLength).toBe(500);
  fireEvent.change(reason, { target: { value: "  Spam links  " } });
  fireEvent.click(dialogButton(dialog, "Hide comment"));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/content/comment/c9/hide");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ reason: "Spam links" });
});

// source: spec 3.11 P-52 - "show an Unhide action on hidden content"; openapi PATCH .../unhide
test("Unhide makes the content visible again", async () => {
  const fetchMock = vi.fn().mockResolvedValue(json(200, {}));
  vi.stubGlobal("fetch", fetchMock);
  const onHiddenChange = vi.fn();
  render(<AdminContentActions type="review" id="r1" hidden onHiddenChange={onHiddenChange} />);

  fireEvent.click(screen.getByRole("button", { name: "Unhide" }));

  await waitFor(() => expect(onHiddenChange).toHaveBeenCalledWith(false));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/content/review/r1/unhide");
  expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
  expect(screen.getByRole("button", { name: "Hide" })).toBeTruthy();
});

// source: Excel GEN-03 confirmation before destructive actions; spec P-52 "Delete content (with confirmation)"
test("Delete asks first; going back deletes nothing", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<AdminContentActions type="itinerary" id="i1" hidden={false} />);

  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(dialogButton(dialog, "Go back"));

  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(fetchMock).not.toHaveBeenCalled();
});

// source: Excel GEN-10 - delete content; openapi DELETE /api/admin/content/{type}/{id} -> 204
test("confirming Delete calls DELETE and tells the page", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  const onDeleted = vi.fn();
  render(<AdminContentActions type="itinerary" id="i1" hidden={false} onDeleted={onDeleted} />);

  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(dialogButton(dialog, "Delete itinerary"));

  await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/content/itinerary/i1");
  expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
});

// source: Excel GEN-16 - error feedback (backend 404 "Content not found.")
test("a failure shows the backend's message and changes nothing", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(404, { statusCode: 404, error: "NOT_FOUND", message: "Content not found." })));
  const onHiddenChange = vi.fn();
  render(<AdminContentActions type="post" id="p1" hidden onHiddenChange={onHiddenChange} />);

  fireEvent.click(screen.getByRole("button", { name: "Unhide" }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Content not found."));
  expect(onHiddenChange).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Unhide" })).toBeTruthy();
});
