// P-11 + header bell against the real backend (GEN-01). Nothing is marked read here (shared demo
// accounts); we check the bell dropdown, the "See all" link and the page for each kind of shell.
import { expect, test } from "@playwright/test";
import { loginAsDemo } from "./support/login";

// source: team leader decision 1 (24 Nov) - the bell opens a dropdown with "See all" to /notifications
test("a traveler opens the bell dropdown and goes to the full page", async ({ page }) => {
  await loginAsDemo(page, "demo.user@yallaway.local");
  await page.goto("/account");

  await page.getByRole("button", { name: /^Notifications/ }).click();
  const dropdown = page.getByRole("dialog");
  await expect(dropdown).toBeVisible();
  await dropdown.getByRole("link", { name: "See all" }).click();

  await expect(page).toHaveURL(/\/notifications$/);
  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
});

// source: Excel GEN-01 - every logged-in role has notifications (moderators use the dashboard shell)
test("a moderator sees the notifications page with Mark all as read or the empty state", async ({ page }) => {
  await loginAsDemo(page, "demo.airline@yallaway.local");
  await page.goto("/notifications");

  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mark all as read" }).or(page.getByText("No notifications yet")),
  ).toBeVisible();
});

// source: ACC-10 / requireUser - a guest is sent to log in first
test("a guest is sent to login and back to /notifications", async ({ page }) => {
  await page.goto("/notifications");

  await expect(page).toHaveURL(/\/login\?returnTo=%2Fnotifications/);
});
