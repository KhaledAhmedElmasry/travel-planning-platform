// Checks the Playwright setup: a real browser against the running frontend.
import { expect, test } from "@playwright/test";

// source: Excel ACC-11 - unauthorised or unknown resources are rejected with 403/404;
// Next.js 16 docs - an unknown route answers with HTTP status 404.
test("an unknown URL answers 404", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist");
  expect(response?.status()).toBe(404);
});
