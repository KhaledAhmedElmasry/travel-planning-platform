// P-05 / P-06 against the real backend. Nothing is saved or deactivated here (shared demo
// accounts); we check what each role sees and that the deactivation asks first.
import { expect, test } from "@playwright/test";
import { loginAsDemo } from "./support/login";

// source: Excel ACC-09 - the logged-in user sees name, phone and preferred currency to edit
test("a traveler sees the profile form with the email and the deactivate section", async ({ page }) => {
  await loginAsDemo(page, "demo.user@yallaway.local");
  await page.goto("/account");

  await expect(page.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
  await expect(page.getByText("demo.user@yallaway.local", { exact: true }).last()).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Name" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Preferred currency" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Deactivate account" })).toBeVisible();
});

// source: Excel GEN-03 - confirmation before destructive actions (ACC-12)
test("deactivating opens a confirmation that can be cancelled", async ({ page }) => {
  await loginAsDemo(page, "demo.user@yallaway.local");
  await page.goto("/account");

  await page.getByRole("button", { name: "Deactivate account" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep my account" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});

// source: Excel ACC-12 - deactivation is for registered users; ACC-09 - every logged-in user edits the profile
test("a moderator sees the profile form but no deactivate section", async ({ page }) => {
  await loginAsDemo(page, "demo.airline@yallaway.local");
  await page.goto("/account");

  await expect(page.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Deactivate account" })).toHaveCount(0);
});
