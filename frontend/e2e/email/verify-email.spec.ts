// P-08 Verify email (ACC-02 bonus) with the emailed link (opt-in: npm run test:e2e:email, see README).
import { expect, test } from "@playwright/test";
import { linkFromLog, requireThrowawayBackend, uniqueEmail } from "../support/backend-log";

// source: Excel ACC-02 - verification link emailed after registration; works once (openapi)
test("the emailed link verifies the new account once", async ({ page }) => {
  requireThrowawayBackend();
  const email = uniqueEmail("verify");
  const res = await page.request.post("/api/auth/register", { data: { name: "E2E Verify", email, password: "Journey2027", acceptTerms: true } });
  expect(res.status()).toBe(201);
  const link = await linkFromLog("Verification", email);

  await page.goto(link);
  await expect(page.getByRole("heading", { level: 1, name: "Email verified" })).toBeVisible();
  await expect(page.getByText("Email verified. You can now book flights and hotels")).toBeVisible();
  await page.getByRole("link", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto(link);
  await expect(page.getByRole("heading", { level: 1, name: "Link not valid" })).toBeVisible();
});
