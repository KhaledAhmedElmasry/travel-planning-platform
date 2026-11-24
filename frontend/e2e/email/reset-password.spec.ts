// P-10 Reset password (ACC-07 bonus) with the emailed link (opt-in: npm run test:e2e:email, see README).
import { expect, test } from "@playwright/test";
import { linkFromLog, requireThrowawayBackend, uniqueEmail } from "../support/backend-log";

// source: Excel ACC-07 - reset link by email, single-use; openapi: then log in with the new password;
// team leader (24 Nov, Q14A/Q15A/Q18A/Q19A)
test("the emailed link sets a new password once, then the user logs in with it", async ({ page }) => {
  requireThrowawayBackend();
  const email = uniqueEmail("reset");
  expect((await page.request.post("/api/auth/register", { data: { name: "E2E Reset", email, password: "Journey2027", acceptTerms: true } })).status()).toBe(201);
  expect((await page.request.post("/api/auth/forgot-password", { data: { email } })).status()).toBe(200);
  const link = await linkFromLog("Password reset", email);

  await page.goto(link);
  await expect(page).toHaveURL(/\/reset-password$/); // token removed from the address bar
  await page.getByRole("textbox", { name: "New password", exact: true }).fill("Voyage2028");
  await page.getByRole("textbox", { name: "Confirm new password" }).fill("Voyage2028");
  await page.getByRole("button", { name: "Reset password" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Password changed. Log in with your new password")).toBeVisible();
  await expect(page.getByText("You were logged out on all devices.")).toBeVisible();
  expect((await page.request.post("/api/auth/login", { data: { email, password: "Voyage2028" } })).status()).toBe(200);

  await page.goto(link);
  await page.getByRole("textbox", { name: "New password", exact: true }).fill("Another2029");
  await page.getByRole("textbox", { name: "Confirm new password" }).fill("Another2029");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByText(/invalid, expired or already used/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Request a new link" })).toBeVisible();
});
