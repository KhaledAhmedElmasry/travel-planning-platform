// P-14 Book a flight (/flights/[id]/book) against the real backend as demo.user.
// Team leader (26 Nov): this spec makes a REAL hold on the database (one Pending Payment booking of 1 seat per run
// and project; it expires by itself after 10 minutes, FLT-22). Needs the demo flights (npm run seed:demo).
import { expect, test, type APIRequestContext } from "@playwright/test";
import { loginAsDemo } from "./support/login";

type Details = { id: string; cabins: { cabinClass: string; soldOut: boolean }[] };

/** A scheduled CAI -> DXB demo flight in the next 60 days with an open cabin. */
async function demoFlight(request: APIRequestContext): Promise<{ id: string; cabinClass: string }> {
  for (let day = 1; day <= 60; day++) {
    const date = new Date(Date.now() + day * 86_400_000).toISOString().slice(0, 10);
    const res = await request.get(`/api/flights/search?origin=CAI&destination=DXB&departureDate=${date}`);
    const items = res.ok() ? ((await res.json()) as { items: { id: string }[] }).items : [];
    for (const item of items) {
      const details = (await (await request.get(`/api/flights/${item.id}`)).json()) as Details;
      const open = details.cabins.find((c) => !c.soldOut);
      if (open) return { id: details.id, cabinClass: open.cabinClass };
    }
  }
  throw new Error("No open CAI -> DXB flight in the next 60 days: run npm run seed:demo");
}

// source: Excel ACC-10 a guest who tries a restricted action logs in first; FLT-19 actor Registered User
test("a guest who opens the booking page is sent to log in", async ({ page }) => {
  const flight = await demoFlight(page.request);
  await page.goto(`/flights/${flight.id}/book?cabinClass=${flight.cabinClass}&adults=1`);

  await expect(page).toHaveURL(/\/(resume-session|login)\?returnTo=/);
});

// source: Excel FLT-19 passenger details; FLT-21 summary before payment; FLT-22 hold on proceed to payment;
// PAY-02 policies with an acceptance checkbox; PR #337 (merged by the team leader) a refresh goes to P-16
test("one adult goes through Passengers and Summary, the seat is held, and the policies follow", async ({ page }) => {
  const flight = await demoFlight(page.request);
  await loginAsDemo(page, "demo.user@yallaway.local");
  await page.goto(`/flights/${flight.id}/book?cabinClass=${flight.cabinClass}&adults=1`);

  const adult = page.getByRole("group", { name: "Adult 1" });
  await adult.getByLabel(/Full name/).fill("Mona Hassan");
  await adult.getByLabel(/Date of birth/).fill("1990-01-01");
  await adult.getByLabel(/Passport or ID number/).fill("A1234567");

  const summary = page.waitForResponse((r) => r.url().endsWith("/api/flight-bookings") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Continue" }).click();
  const quote = (await (await summary).json()) as { totalAmount: number };
  await expect(page.locator('li[aria-current="step"]')).toContainText("Summary");
  await expect(page.getByText("Mona Hassan")).toBeVisible();

  const hold = page.waitForResponse((r) => r.url().endsWith("/api/flight-bookings/hold") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Proceed to payment" }).click();
  const created = await hold;
  expect(created.status()).toBe(201);
  const booking = (await created.json()) as { id: string; status: string; totalAmount: number };
  // source: Excel FLT-22 "creating a booking in Pending Payment status"
  expect(booking.status).toBe("pending_payment");
  expect(booking.totalAmount).toBe(quote.totalAmount);
  await expect(page.getByRole("checkbox")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`bookingId=${booking.id}`));

  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/checkout/flight/${booking.id}$`));
});
