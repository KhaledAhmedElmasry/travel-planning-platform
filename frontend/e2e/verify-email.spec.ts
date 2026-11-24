// P-08 Verify email (ACC-02 bonus) against the real backend.
import { expect, test } from "@playwright/test";
import { linkFromLog, requireThrowawayBackend, uniqueEmail } from "./support/backend-log";

// source: openapi GET /api/auth/verify-email 400; team leader (24 Nov, Q2A/Q3A) - one failure state
test("a link with an unknown token shows the failure state", async ({ page }) => {
  await page.goto("/verify-email?token=not-a-real-token");

  await expect(page.getByRole("heading", { level: 1, name: "Link not valid" })).toBeVisible();
  await expect(page.getByText("The token is invalid, expired or already used.")).toBeVisible();
  await expect(page.getByText("If you already verified, you can log in.")).toBeVisible();
});

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
