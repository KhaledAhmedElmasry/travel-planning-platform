// P-01 Sign up against the real backend. No account is created here (shared database):
// we use an email that already exists (the demo user) and check the inline error.
import { expect, test } from "@playwright/test";

// source: Excel ACC-01 - "reject the form with an inline error if the email is ... already registered"
test("signing up with an email that is already registered shows an error under the email field", async ({ page }) => {
  await page.goto("/signup");
  await page.getByRole("textbox", { name: "Name" }).fill("E2E Check");
  await page.getByRole("textbox", { name: "Email" }).fill("demo.user@yallaway.local");
  await page.getByRole("textbox", { name: "Password" }).fill("Secret123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Sign up" }).click();

  await expect(page.getByRole("textbox", { name: "Email" })).toHaveAttribute("aria-invalid", "true");
  await expect(page).toHaveURL(/\/signup$/);
});
