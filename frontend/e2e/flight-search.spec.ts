// P-12 Flight search (/flights) against the real backend, as a guest. Read-only: it only searches.
// Needs the demo flights (npm run seed:demo: Demo Air CAI <-> DXB). The dates are looked up through
// GET /api/flights/search first, so the test does not depend on fixed dates.
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/** The first local date in the next 60 days with a flight from -> to (from the date `after`, if given). */
async function dateWithFlight(request: APIRequestContext, from: string, to: string, after?: string): Promise<string> {
  const start = after ? new Date(`${after}T00:00:00Z`) : new Date();
  for (let day = 1; day <= 60; day++) {
    const date = new Date(start.getTime() + day * 86_400_000).toISOString().slice(0, 10);
    const res = await request.get(`/api/flights/search?origin=${from}&destination=${to}&departureDate=${date}`);
    if (res.ok() && ((await res.json()) as { total: number }).total > 0) return date;
  }
  throw new Error(`No ${from} -> ${to} flight in the next 60 days: run npm run seed:demo`);
}

/** The first local date in the next 60 days with no flight from -> to (the search answers 200 with no items). */
async function dateWithoutFlight(request: APIRequestContext, from: string, to: string): Promise<string> {
  for (let day = 1; day <= 60; day++) {
    const date = new Date(Date.now() + day * 86_400_000).toISOString().slice(0, 10);
    const res = await request.get(`/api/flights/search?origin=${from}&destination=${to}&departureDate=${date}`);
    if (res.ok() && ((await res.json()) as { total: number }).total === 0) return date;
  }
  throw new Error(`Every day of the next 60 has a ${from} -> ${to} flight`);
}

const query = (page: Page) => Object.fromEntries(new URL(page.url()).searchParams);

// source: Excel FLT-11 list the flights found; GEN-06 flight times in each airport's local time zone
test("a one-way search lists the flights with local times", async ({ page }) => {
  const date = await dateWithFlight(page.request, "CAI", "DXB");
  await page.goto(`/flights?origin=CAI&destination=DXB&departureDate=${date}`);

  const results = page.getByRole("region", { name: "Search results" });
  await expect(results.getByRole("article").first()).toBeVisible();
  await expect(results.getByText(/Local time/).first()).toBeVisible();
});

// source: Excel FLT-11 "allow the user to select a flight and cabin category to continue";
// team leader (26 Nov): P-14 URL /flights/{outboundId}/book?cabinClass=&adults=&children=&infants=
test("choosing a cabin continues to booking with the cabin and passengers", async ({ page }) => {
  const date = await dateWithFlight(page.request, "CAI", "DXB");
  await page.goto(`/flights?origin=CAI&destination=DXB&departureDate=${date}&adults=2&children=1&infants=1`);

  const firstRow = page.getByRole("region", { name: "Search results" }).getByRole("listitem").first();
  await firstRow.getByRole("button", { name: /select/i }).click();

  await page.waitForURL(/\/flights\/[a-f0-9]{24}\/book\?/);
  expect(query(page)).toMatchObject({ adults: "2", children: "1", infants: "1" });
  expect(["economy", "premium_economy", "business", "first"]).toContain(query(page).cabinClass);
});

// source: Excel FLT-15 "sort results by price, duration or departure time" while "preserving the other search criteria"
test("changing the sort keeps the search and the price filter", async ({ page }) => {
  const date = await dateWithFlight(page.request, "CAI", "DXB");
  await page.goto(`/flights?origin=CAI&destination=DXB&departureDate=${date}&maxPrice=99999900`);

  await page.getByRole("combobox", { name: "Sort by" }).click();
  await page.getByRole("option", { name: "Price: high to low" }).click();

  await page.waitForURL(/sortOrder=desc/);
  expect(query(page)).toMatchObject({ origin: "CAI", destination: "DXB", departureDate: date, maxPrice: "99999900", sortBy: "price", sortOrder: "desc" });
});

// source: Excel FLT-11 show "no flights found" when no match exists; GEN-04; team leader (26 Nov): both texts
test("a search with no match shows the empty state", async ({ page }) => {
  const date = await dateWithoutFlight(page.request, "CAI", "DXB");
  await page.goto(`/flights?origin=CAI&destination=DXB&departureDate=${date}`);

  const results = page.getByRole("region", { name: "Search results" });
  await expect(results.getByText("No flights found", { exact: true })).toBeVisible();
  await expect(results.getByText("Nothing here… try other dates?")).toBeVisible();
});

// source: Excel FLT-12 (a) round trip returns outbound and return options, booked as one booking;
// team leader (26 Nov): P-14 URL plus returnFlightId=&returnCabinClass=
test("a round trip continues only after an outbound and a return cabin are chosen", async ({ page }) => {
  const out = await dateWithFlight(page.request, "CAI", "DXB");
  const back = await dateWithFlight(page.request, "DXB", "CAI", out);
  await page.goto(`/flights?tripType=round_trip&origin=CAI&destination=DXB&departureDate=${out}&returnDate=${back}`);

  const continueButton = page.getByRole("button", { name: "Continue" });
  await page.getByRole("region", { name: "Outbound" }).getByRole("button", { name: /select/i }).first().click();
  await expect(continueButton).toBeDisabled();
  await page.getByRole("region", { name: "Return" }).getByRole("button", { name: /select/i }).first().click();
  await continueButton.click();

  await page.waitForURL(/\/flights\/[a-f0-9]{24}\/book\?/);
  expect(query(page).returnFlightId).toMatch(/^[a-f0-9]{24}$/);
  expect(["economy", "premium_economy", "business", "first"]).toContain(query(page).returnCabinClass);
});

// source: Excel GEN-16 "responsive across desktop, tablet, and mobile screen sizes"
test("at phone width the page fits and the filters open in a panel", async ({ page }) => {
  const date = await dateWithFlight(page.request, "CAI", "DXB");
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`/flights?origin=CAI&destination=DXB&departureDate=${date}`);

  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
  await page.getByRole("button", { name: "Filters" }).click();
  await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
});
