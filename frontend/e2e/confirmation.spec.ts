// P-17 against the real backend. A confirmed booking needs a real Stripe payment on the shared db,
// so here: access rules only (ACC-10, ACC-11).
import { expect, test } from "@playwright/test";
import { loginAsDemo } from "./support/login";

// source: Excel ACC-10 - a guest goes to login and comes back
test("a guest who opens a confirmation page is sent to log in", async ({ page }) => {
  await page.goto("/checkout/hotel/665f1c2a9b1e8a00123400a1/done");

  await expect(page).toHaveURL(/\/login\?returnTo=%2Fcheckout%2Fhotel%2F665f1c2a9b1e8a00123400a1%2Fdone$/);
});

// source: Excel ACC-11 - bookings are visible to their owner only (404 otherwise)
test("a booking that is not the user's answers 404", async ({ page }) => {
  await loginAsDemo(page, "demo.user@yallaway.local");
  const res = await page.goto("/checkout/hotel/665f1c2a9b1e8a00123400a1/done");

  expect(res?.status()).toBe(404);
});
