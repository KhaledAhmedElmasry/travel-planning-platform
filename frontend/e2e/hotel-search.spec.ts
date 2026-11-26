// P-15 Hotel search (/hotels) against the real backend, as a guest. Read-only: it only searches.
// Needs the demo hotels (npm run seed:demo: Demo Hotel Cairo). The dates are looked up through
// GET /api/hotels/search first, so the test does not depend on fixed dates.
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

type Found = { items: { id: string; cityId: string; countryCode: string }[]; total: number };
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

/** The first one-night stay in Cairo in the next 90 days that has (or has no) free hotel for 1 guest. */
async function cairoStay(request: APIRequestContext, withHotel: boolean): Promise<{ checkIn: string; checkOut: string; found: Found }> {
  const days = Array.from({ length: 90 }, (_, i) => i + 1);
  const all = await Promise.all(
    days.map(async (n) => {
      const res = await request.get(`/api/hotels/search?city=cairo&checkIn=${day(n)}&checkOut=${day(n + 1)}&guests=1`);
      return { checkIn: day(n), checkOut: day(n + 1), ok: res.ok(), found: (await res.json()) as Found };
    }),
  );
  const stay = all.find((s) => s.ok && s.found.total > 0 === withHotel);
  if (stay) return { checkIn: stay.checkIn, checkOut: stay.checkOut, found: stay.found };
  throw new Error(`No Cairo stay ${withHotel ? "with" : "without"} a free hotel in the next 90 days: run npm run seed:demo`);
}

const query = (page: Page) => Object.fromEntries(new URL(page.url()).searchParams);
const results = (page: Page) => page.getByRole("region", { name: "Hotel search results" });

// source: Excel HTL-11 list hotels for a city; spec P-15 card "city and country"; GEN-12 official reference data;
// HotelResultCard header (team leader 23 Nov): the card links to /hotels/{id} with the searched dates, guests and rooms
test("a city search lists hotels with their place names and links to the hotel", async ({ page }) => {
  const { checkIn, checkOut, found } = await cairoStay(page.request, true);
  const city = ((await (await page.request.get("/api/cities?page=1")).json()) as { items: { cityId: string; name: string }[] }).items.find((c) => c.cityId === "cairo")!;
  await page.goto(`/hotels?city=cairo&checkIn=${checkIn}&checkOut=${checkOut}&guests=1&rooms=1`);

  const card = results(page).getByRole("article").first();
  await expect(card.getByText(new RegExp(`^${city.name}, `))).toBeVisible();
  await expect(results(page).getByRole("article")).toHaveCount(found.items.length);
  expect(await card.getByRole("link").getAttribute("href")).toBe(`/hotels/${found.items[0].id}?checkIn=${checkIn}&checkOut=${checkOut}&guests=1&rooms=1`);
});

// source: Excel HTL-11 search "by city or country"
test("a country search lists the hotels too", async ({ page }) => {
  const { checkIn, checkOut } = await cairoStay(page.request, true);
  await page.goto(`/hotels?country=EG&checkIn=${checkIn}&checkOut=${checkOut}&guests=1`);

  await expect(results(page).getByRole("article").first()).toBeVisible();
});

// source: Excel HTL-12 "sort the results by that price or by rating"; FilterPanel/SortSelect headers keep every other criterion
test("changing the sort keeps the search and the price filter", async ({ page }) => {
  const { checkIn, checkOut } = await cairoStay(page.request, true);
  await page.goto(`/hotels?city=cairo&checkIn=${checkIn}&checkOut=${checkOut}&guests=1&rooms=1&maxPrice=99999900`);

  await page.getByRole("combobox", { name: "Sort by" }).click();
  await page.getByRole("option", { name: "Rating: highest" }).click();

  await page.waitForURL(/sortBy=rating/);
  expect(query(page)).toMatchObject({ city: "cairo", checkIn, checkOut, guests: "1", rooms: "1", maxPrice: "99999900", sortBy: "rating", sortOrder: "desc" });
});

// source: Excel HTL-12 inclusive max price per night; FilterPanel header: whole amounts sent in cents
test("a max price filter is sent in cents and keeps the search", async ({ page }) => {
  const { checkIn, checkOut } = await cairoStay(page.request, true);
  // Desktop width: the filter panel beside the results (the phone panel is checked in the last test).
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/hotels?city=cairo&checkIn=${checkIn}&checkOut=${checkOut}&guests=1&rooms=1`);

  const filters = page.getByRole("form", { name: "Filters" }).first();
  await filters.getByLabel(/^Max price/).fill("1");
  await filters.getByRole("button", { name: "Apply" }).click();

  await page.waitForURL(/maxPrice=100/);
  expect(query(page)).toMatchObject({ city: "cairo", checkIn, checkOut, guests: "1", rooms: "1", maxPrice: "100" });
});

// source: Excel GEN-04; handout-T2 GEN-04 line "Nothing here… try other dates?"
test("a search with no free hotel shows the empty state", async ({ page }) => {
  const { checkIn, checkOut } = await cairoStay(page.request, false);
  await page.goto(`/hotels?city=cairo&checkIn=${checkIn}&checkOut=${checkOut}&guests=1`);

  await expect(results(page).getByText("Nothing here… try other dates?")).toBeVisible();
});

// source: Excel HTL-11 "check-in cannot be in the past"; GEN-16 understandable error messages (the backend's own text)
test("a check-in in the past shows the backend's message", async ({ page }) => {
  const url = `city=cairo&checkIn=${day(-3)}&checkOut=${day(-1)}&guests=1`;
  const res = await page.request.get(`/api/hotels/search?${url}`);
  expect(res.status()).toBe(400);
  const { message } = (await res.json()) as { message: string };
  await page.goto(`/hotels?${url}`);

  await expect(results(page).getByRole("alert")).toContainText(message);
});

// source: Excel GEN-16 "responsive across desktop, tablet, and mobile screen sizes"
test("at phone width the page fits and the filters open in a panel", async ({ page }) => {
  const { checkIn, checkOut } = await cairoStay(page.request, true);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`/hotels?city=cairo&checkIn=${checkIn}&checkOut=${checkOut}&guests=1`);

  await expect(results(page).getByRole("article").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
  await page.getByRole("button", { name: "Filters" }).click();
  await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
});
