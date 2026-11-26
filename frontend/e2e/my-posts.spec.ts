// P-33 My posts against the real backend (BLG-03). Read-only: nothing is deleted on the shared db
// (the DELETE is answered by the test and never reaches the backend).
import { expect, test } from "@playwright/test";
import { loginAsDemo } from "./support/login";

type MyPostList = { items: { id: string; title: string }[]; total: number };

// source: Excel BLG-03 "list their own posts, including drafts"; openapi GET /api/posts/mine (newest first)
test("a traveler sees the same posts as GET /api/posts/mine, each with an edit link", async ({ page }) => {
  await loginAsDemo(page, "demo.user@yallaway.local");
  const res = await page.request.get("/api/posts/mine?page=1");
  expect(res.status()).toBe(200);
  const mine = (await res.json()) as MyPostList;

  await page.goto("/my/posts");

  await expect(page.getByRole("heading", { level: 1, name: "My posts" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(mine.items.length);
  for (const post of mine.items) {
    const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: post.title, exact: true }) });
    await expect(card.locator(`a[href="/my/posts/${post.id}/edit"]`)).toHaveCount(1);
  }
});

// source: Excel GEN-03 confirmation before delete; openapi DELETE /api/posts/{id} 204
test("Delete asks first and sends DELETE /api/posts/{id} only after confirming", async ({ page }) => {
  await loginAsDemo(page, "demo.user@yallaway.local");
  const mine = (await (await page.request.get("/api/posts/mine?page=1")).json()) as MyPostList;
  expect(mine.items.length, "demo.user needs at least one post").toBeGreaterThan(0);
  const deletes: string[] = [];
  await page.route("**/api/posts/*", (route) => {
    if (route.request().method() !== "DELETE") return route.continue();
    deletes.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 204 });
  });

  await page.goto("/my/posts");
  const first = page.getByRole("article").first();
  await first.getByRole("button", { name: /delete/i }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  expect(deletes).toEqual([]);
  await dialog.getByRole("button", { name: /delete/i }).click();

  await expect(dialog).toBeHidden();
  expect(deletes).toEqual([`/api/posts/${mine.items[0].id}`]);
});

// source: ACC-10 / requireUser - a guest is sent to log in first
test("a guest is sent to login and back to /my/posts", async ({ page }) => {
  await page.goto("/my/posts");

  await expect(page).toHaveURL(/\/login\?returnTo=%2Fmy%2Fposts$/);
});

// source: Khaled's popup answers 26 Nov ("Empty-page text", "Go to page 1"); Excel GEN-05 pagination
test("a page past the last one says it is empty and links back to page 1", async ({ page }) => {
  await loginAsDemo(page, "demo.user@yallaway.local");
  const mine = (await (await page.request.get("/api/posts/mine?page=1")).json()) as MyPostList;
  expect(mine.total, "demo.user needs at least one post").toBeGreaterThan(0);

  await page.goto("/my/posts?page=99");

  await expect(page.getByText("This page is empty")).toBeVisible();
  await expect(page.getByText("No posts yet")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Go to page 1" })).toHaveAttribute("href", "/my/posts");
});

// source: Khaled's popup answers 26 Nov ("Add hidden text", "Keep singular"); Excel BLG-03 like and comment counts
test("screen readers hear the like and comment counts as words", async ({ page }) => {
  await loginAsDemo(page, "demo.user@yallaway.local");
  const mine = (await (await page.request.get("/api/posts/mine?page=1")).json()) as {
    items: { title: string; likeCount: number; commentCount: number }[];
  };

  await page.goto("/my/posts");

  for (const post of mine.items) {
    const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: post.title, exact: true }) });
    const likes = `${post.likeCount} ${post.likeCount === 1 ? "like" : "likes"}`;
    const comments = `${post.commentCount} ${post.commentCount === 1 ? "comment" : "comments"}`;
    await expect(card.locator(".sr-only", { hasText: new RegExp(`^${likes}$`) })).toHaveCount(1);
    await expect(card.locator(".sr-only", { hasText: new RegExp(`^${comments}$`) })).toHaveCount(1);
  }
});
