// /terms Terms & Privacy: reachable from the footer and from the sign-up consent label.
// Needs no backend data (static page).
import { expect, test } from "@playwright/test";

// source: spec P-01 / section 3 - /terms is "linked from sign-up and the footer"
test("the footer link opens the Terms & Privacy page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Terms & Privacy" }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole("heading", { level: 1, name: "Terms & Privacy" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("Placeholder text for a student project");
});

test("/terms answers 200", async ({ page }) => {
  const response = await page.goto("/terms");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("note")).toContainText("Placeholder text for a student project");
});

// source: team leader in chat (23 Nov) - the consent link opens /terms in a new tab (form kept, GEN-15)
test("the sign-up consent link opens /terms in a new tab", async ({ page, context }) => {
  await page.goto("/signup");
  const [tab] = await Promise.all([
    context.waitForEvent("page"),
    page.getByRole("link", { name: /terms & privacy policy/i }).click(),
  ]);
  await tab.waitForLoadState();
  await expect(tab).toHaveURL(/\/terms$/);
  await expect(tab.getByRole("heading", { level: 1, name: "Terms & Privacy" })).toBeVisible();
  await expect(tab.getByRole("note")).toContainText("Placeholder text for a student project");
  await expect(page).toHaveURL(/\/signup$/);
});
