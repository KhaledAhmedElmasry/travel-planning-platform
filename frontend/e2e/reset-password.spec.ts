// P-10 Reset password (ACC-07 bonus) against the real backend.
import { expect, test } from "@playwright/test";

// source: team leader (24 Nov, Q17A) - no token: no form, link to request a new one
test("a link without a token shows no form", async ({ page }) => {
  await page.goto("/reset-password");

  await expect(page.getByText("This reset link is incomplete.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Request a new link" })).toHaveAttribute("href", "/forgot-password");
});
