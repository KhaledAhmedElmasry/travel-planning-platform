// P-24 My itineraries against the real backend (ITN-03). Read-only: nothing is created or changed.
import { expect, test } from "@playwright/test";
import { loginAsDemo } from "./support/login";

type Summary = { id: string; title: string; countryCodes: string[]; numberOfDays: number; visibility: "private" | "public" };
type List = { items: Summary[]; total: number };
type Country = { code: string; name: string };

// source: Excel ITN-03 "list their itineraries (title, countries, start date, days and visibility), most recently
// updated first, and open any itinerary"; openapi GET /api/itineraries (ItinerarySummaryList)
test("a traveler sees the same itineraries as GET /api/itineraries, in its order, with full country names", async ({ page }) => {
  await loginAsDemo(page, "demo.user@yallaway.local");
  const mine = (await (await page.request.get("/api/itineraries?page=1")).json()) as List;
  expect(mine.items.length, "demo.user needs at least one itinerary (npm run seed:demo)").toBeGreaterThan(0);
  const countries: Country[] = [];
  for (let p = 1, last = 1; p <= last; p++) {
    const res = (await (await page.request.get(`/api/countries?page=${p}`)).json()) as { items: Country[]; totalPages: number };
    countries.push(...res.items);
    last = res.totalPages;
  }
  const nameOf = (code: string) => countries.find((c) => c.code === code)?.name;

  await page.goto("/my/itineraries");

  await expect(page.getByRole("heading", { level: 1, name: "My itineraries" })).toBeVisible();
  const cards = page.getByRole("article");
  await expect(cards).toHaveCount(mine.items.length);
  await expect(cards.getByRole("heading")).toHaveText(mine.items.map((i) => i.title));
  for (const [n, it] of mine.items.entries()) {
    const card = cards.nth(n);
    await expect(card.getByRole("link", { name: it.title })).toHaveAttribute("href", `/my/itineraries/${it.id}`);
    await expect(card.getByText(new RegExp(`^${it.numberOfDays} days?$`))).toBeVisible();
    await expect(card).toContainText(new RegExp(it.visibility, "i"));
    for (const code of it.countryCodes) {
      const name = nameOf(code);
      if (name) await expect(card).toContainText(name);
    }
  }
});

// source: Excel ITN-03 "open any itinerary to view its full details"; handout T1 P-24 links to /my/itineraries/[id]
test("clicking a title opens that itinerary", async ({ page }) => {
  await loginAsDemo(page, "demo.user@yallaway.local");
  const mine = (await (await page.request.get("/api/itineraries?page=1")).json()) as List;
  const first = mine.items[0];

  await page.goto("/my/itineraries");
  await page.getByRole("article").first().getByRole("link", { name: first.title }).click();

  await expect(page).toHaveURL(new RegExp(`/my/itineraries/${first.id}$`));
});

// source: handout T1 P-24 links to T3's /my/itineraries/new
test("the page links to creating a new itinerary", async ({ page }) => {
  await loginAsDemo(page, "demo.user@yallaway.local");

  await page.goto("/my/itineraries");

  await expect(page.locator('main a[href="/my/itineraries/new"]').first()).toBeVisible();
});

// source: ACC-10 / requireUser - a guest is sent to log in first
test("a guest is sent to login and back to /my/itineraries", async ({ page }) => {
  await page.goto("/my/itineraries");

  await expect(page).toHaveURL(/\/login\?returnTo=%2Fmy%2Fitineraries$/);
});

// source: Khaled's P-33 decision 26 Nov (a page past the end links back to page 1); Excel GEN-05 pagination
test("a page past the last one shows no cards and links back to page 1", async ({ page }) => {
  await loginAsDemo(page, "demo.user@yallaway.local");

  await page.goto("/my/itineraries?page=99");

  await expect(page.getByRole("article")).toHaveCount(0);
  await page.locator('main a[href="/my/itineraries"]').click();
  await expect(page).toHaveURL(/\/my\/itineraries$/);
  await expect(page.getByRole("article").first()).toBeVisible();
});
