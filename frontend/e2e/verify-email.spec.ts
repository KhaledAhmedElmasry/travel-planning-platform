// P-08 Verify email (ACC-02 bonus) against the real backend.
import { expect, test } from "@playwright/test";

// source: openapi GET /api/auth/verify-email 400; team leader (24 Nov, Q2A/Q3A) - one failure state
test("a link with an unknown token shows the failure state", async ({ page }) => {
  await page.goto("/verify-email?token=not-a-real-token");

  await expect(page.getByRole("heading", { level: 1, name: "Link not valid" })).toBeVisible();
  await expect(page.getByText("The token is invalid, expired or already used.")).toBeVisible();
  await expect(page.getByText("If you already verified, you can log in.")).toBeVisible();
});
