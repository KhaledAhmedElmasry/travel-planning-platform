// P-16 against the real backend. A real card payment needs the Stripe publishable key and a held
// booking on the shared db, so here: access rules only (ACC-10, ACC-11).
import { expect, test } from "@playwright/test";
import { loginAsDemo } from "./support/login";

// source: Excel ACC-10 - a guest who tries a restricted action goes to login and comes back
test("a guest who opens the payment page is sent to log in", async ({ page }) => {
  await page.goto("/checkout/flight/665f1c2a9b1e8a00123400a1");

  await expect(page).toHaveURL(/\/login\?returnTo=%2Fcheckout%2Fflight%2F665f1c2a9b1e8a00123400a1$/);
});

// source: Excel ACC-11 - bookings are visible to their owner only (404 otherwise)
test("a booking that is not the user's answers 404", async ({ page }) => {
  await loginAsDemo(page, "demo.user@yallaway.local");
  const res = await page.goto("/checkout/flight/665f1c2a9b1e8a00123400a1");

  expect(res?.status()).toBe(404);
});

// source: route /checkout/[type]/... only for flight or hotel bookings
test("an unknown booking type answers 404", async ({ page }) => {
  await loginAsDemo(page, "demo.user@yallaway.local");
  const res = await page.goto("/checkout/cruise/665f1c2a9b1e8a00123400a1");

  expect(res?.status()).toBe(404);
});
