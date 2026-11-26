// P-33 My posts (BLG-03): the author's posts incl. drafts with title, status, date, like and comment
// counts; Edit links to /my/posts/[id]/edit; Delete asks first (GEN-03), then DELETE /api/posts/{id}.
// Only fetch, the router and the toast are faked.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const refresh = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }) }));

import { MyPostsList, type MyPost } from "./my-posts-list";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toast.success.mockReset();
  toast.error.mockReset();
  refresh.mockReset();
});

// openapi MyPostSummary: id, title, status (draft | published), date, likeCount, commentCount
const draft: MyPost = { id: "p1", title: "My London packing list", status: "draft", date: "2026-11-12T10:00:00Z", likeCount: 0, commentCount: 1 };
const published: MyPost = { id: "p2", title: "Pyramids at sunrise", status: "published", date: "2026-11-20T10:00:00Z", likeCount: 7, commentCount: 4 };

const view = (posts: MyPost[], over: { page?: number; total?: number; totalPages?: number } = {}) =>
  render(
    <MyPostsList
      posts={posts}
      page={over.page ?? 1}
      pageSize={10}
      total={over.total ?? posts.length}
      totalPages={over.totalPages ?? (posts.length ? 1 : 0)}
    />,
  );

const card = (title: string) => screen.getByRole("heading", { name: title }).closest("article") as HTMLElement;

// source: Excel BLG-03 "list their own posts, including drafts, with title, status, date, like count and comment count";
// spec P-33 "status (Draft or Published)"; StatusBadge header "post BLG-03 draft | published";
// lib/format formatDate "2026-11-12T10:00:00Z" -> "12 Nov 2026"
test("each post shows its title, status, date, like count and comment count, drafts included", () => {
  view([draft, published]);

  const d = within(card("My London packing list"));
  expect(d.getByText("Draft")).toBeTruthy();
  expect(d.getByText("12 Nov 2026")).toBeTruthy();
  expect(d.getByText("0")).toBeTruthy();
  expect(d.getByText("1")).toBeTruthy();

  const p = within(card("Pyramids at sunrise"));
  expect(p.getByText("Published")).toBeTruthy();
  expect(p.getByText("20 Nov 2026")).toBeTruthy();
  expect(p.getByText("7")).toBeTruthy();
  expect(p.getByText("4")).toBeTruthy();
});

// source: handout T2 "P-33 links to T4's /my/posts/new and /my/posts/[id]/edit (plain links)"
test("each post links to its edit page", () => {
  view([draft, published]);

  const editHrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href")).filter((h) => h?.endsWith("/edit"));
  expect(editHrefs).toEqual(["/my/posts/p1/edit", "/my/posts/p2/edit"]);
});

// source: Excel GEN-03 "ask for confirmation before destructive actions (delete)"; openapi DELETE /api/posts/{id} 204;
// openapi "The frontend asks for confirmation first (GEN-03)"; ConfirmDialog header (closes when onConfirm finishes)
test("Delete asks first, then deletes the post and reloads the list", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  view([draft, published]);

  fireEvent.click(within(card("Pyramids at sunrise")).getByRole("button", { name: /delete/i }));
  expect(fetchMock).not.toHaveBeenCalled();
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: /delete/i }));

  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("/api/posts/p2");
  expect(init.method).toBe("DELETE");
  expect(toast.success).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
});

// source: Excel GEN-03; ConfirmDialog header - default cancelLabel "Go back", the user can back out
test("going back from the confirmation deletes nothing", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  view([draft]);

  fireEvent.click(within(card("My London packing list")).getByRole("button", { name: /delete/i }));
  fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Go back" }));

  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(fetchMock).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
});

// source: openapi DELETE /api/posts/{id} 403 "Not the author of this post."; Excel GEN-16 understandable error
// messages; ConfirmDialog header "If onConfirm throws, it stays open so the page can show the error (toast.error)"
test("a refused delete shows the backend's message and keeps the dialog open", async () => {
  const body = { statusCode: 403, error: "FORBIDDEN", message: "Not the author of this post." };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 403, headers: { "content-type": "application/json" } })));
  view([draft]);

  fireEvent.click(within(card("My London packing list")).getByRole("button", { name: /delete/i }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: /delete/i }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Not the author of this post."));
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  expect(refresh).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();
});

// source: Excel GEN-04 "friendly empty states when a list ... has no results"; EmptyState renders an h2 title;
// handout T2 /my/posts/new link
test("no posts shows an empty state instead of a list", () => {
  view([]);

  expect(screen.queryAllByRole("article")).toEqual([]);
  expect(screen.getByRole("heading", { level: 2 })).toBeTruthy();
  expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
});

// source: Excel GEN-05 "paginate every list longer than 10 rows (page size 10)"; openapi Page param (?page);
// PaginationBar header - links (?page=2) keep the page in the URL
test("more than 10 posts shows pagination links to /my/posts?page=N", () => {
  view([draft], { page: 1, total: 25, totalPages: 3 });

  const nav = screen.getByRole("navigation", { name: "Pagination" });
  expect(within(nav).getByRole("link", { name: "Next page" }).getAttribute("href")).toBe("/my/posts?page=2");
});

// source: team leader popup answer 26 Nov ("Empty-page text"); Excel GEN-05 paginated lists; GEN-04 friendly empty states
test("a page past the last one, while the user has posts, says the page is empty and links to page 1", () => {
  view([], { page: 99, total: 2, totalPages: 1 });

  expect(screen.getByText("This page is empty")).toBeTruthy();
  const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
  expect(hrefs).toContain("/my/posts");
  expect(screen.queryByText("No posts yet")).toBeNull();
});

// source: team leader popup answer 26 Nov - keep "No posts yet" only when total is 0; Excel GEN-04
test("no posts at all keeps the No posts yet empty state", () => {
  view([], { page: 1, total: 0, totalPages: 0 });

  expect(screen.getByText("No posts yet")).toBeTruthy();
  expect(screen.queryByText("This page is empty")).toBeNull();
});

// source: team leader popup answer 26 Nov ("Add hidden text": e.g. "3 likes" and "2 comments" for screen readers); Excel BLG-03
test("like and comment counts have screen-reader text", () => {
  view([{ ...published, likeCount: 3, commentCount: 2 }]);

  const likes = screen.getByText("3 likes");
  const comments = screen.getByText("2 comments");
  expect(likes.className).toContain("sr-only");
  expect(comments.className).toContain("sr-only");
});
