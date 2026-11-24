// P-09 Forgot password (ACC-07 bonus) against the real backend. An unknown email is used, so
// nothing is created or emailed: the answer must be the same as for a real account.
import { expect, test } from "@playwright/test";

const SENT = "If an account with this email exists, a password reset link was sent";

// source: Excel ACC-07 - "the response does not reveal whether the email exists"; team leader (24 Nov, Q9A/Q10A)
test("asking for a reset link shows the same answer and can be sent again", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);

  await page.getByRole("textbox", { name: "Email" }).fill("nobody.e2e@yallaway.local");
  await page.getByRole("button", { name: "Send reset link" }).click();

  await expect(page.getByText(SENT)).toBeVisible();
  await page.getByRole("button", { name: "Send again or use a different email" }).click();
  await expect(page.getByRole("textbox", { name: "Email" })).toHaveValue("nobody.e2e@yallaway.local");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(SENT)).toBeVisible();
  await page.getByRole("link", { name: "Back to log in" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
