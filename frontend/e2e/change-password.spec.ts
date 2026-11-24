// P-04 Change password against the real backend. The demo password is never changed here
// (the shared demo accounts must keep working): we only open the page and check its frame.
import { expect, test } from "@playwright/test";
import { loginAsDemo } from "./support/login";

// source: Excel ACC-08 - any logged-in user can change the password; team leader (23 Nov): travelers see the top navbar (AppShell)
test("a logged-in traveler sees the change password form inside the app", async ({ page }) => {
  await loginAsDemo(page, "demo.user@yallaway.local");
  await page.goto("/account/password");

  await expect(page.getByRole("heading", { level: 1, name: "Change password" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Current password" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Dashboard" })).toHaveCount(0);
});

// source: team leader (23 Nov) - admins and moderators see their DashboardShell
test("an airline moderator sees the change password form inside the dashboard", async ({ page, isMobile }) => {
  await loginAsDemo(page, "demo.airline@yallaway.local");
  await page.goto("/account/password");

  await expect(page.getByRole("heading", { level: 1, name: "Change password" })).toBeVisible();
  // The sidebar is hidden below 1024px (slide-in menu instead), so check it on desktop only.
  if (!isMobile) await expect(page.getByRole("navigation", { name: "Dashboard" })).toBeVisible();
});

// source: Excel ACC-11 - restricted pages refuse guests; ACC-10 - a guest goes to login
test("a guest who opens the page is sent to log in", async ({ page }) => {
  await page.goto("/account/password");

  await expect(page).toHaveURL(/\/login\?returnTo=%2Faccount%2Fpassword$/);
});
