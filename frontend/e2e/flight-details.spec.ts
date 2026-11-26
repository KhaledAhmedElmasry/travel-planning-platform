// P-13 Flight details (/flights/[id]) against the real backend, as a guest. Read-only.
// Needs the demo flights (npm run seed:demo: Demo Air CAI <-> DXB); the flight is found through
// GET /api/flights/search, so the test does not depend on fixed dates or ids.
import { expect, test, type APIRequestContext } from "@playwright/test";

type Details = { id: string; flightNumber: string; airline: { name: string }; cabins: { cabinClass: string; seatsRemaining: number; soldOut: boolean }[] };
const LABEL: Record<string, string> = { economy: "Economy", premium_economy: "Premium Economy", business: "Business", first: "First" };

/** A scheduled CAI -> DXB flight in the next 60 days, with its details. */
async function demoFlight(request: APIRequestContext): Promise<Details> {
  for (let day = 1; day <= 60; day++) {
    const date = new Date(Date.now() + day * 86_400_000).toISOString().slice(0, 10);
    const res = await request.get(`/api/flights/search?origin=CAI&destination=DXB&departureDate=${date}`);
    const items = res.ok() ? ((await res.json()) as { items: { id: string }[] }).items : [];
    if (items.length > 0) return (await (await request.get(`/api/flights/${items[0].id}`)).json()) as Details;
  }
  throw new Error("No CAI -> DXB flight in the next 60 days: run npm run seed:demo");
}

// source: Excel FLT-17 flight details; spec P-13 airline, flight number, each cabin category with seats remaining
test("shows the airline, flight number and every cabin by name with its seats", async ({ page }) => {
  const flight = await demoFlight(page.request);
  await page.goto(`/flights/${flight.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${flight.airline.name} ${flight.flightNumber}`);
  const cabins = page.getByRole("region", { name: "Cabins and fares" }).getByRole("listitem");
  await expect(cabins).toHaveCount(flight.cabins.length);
  for (const [i, cabin] of flight.cabins.entries()) {
    await expect(cabins.nth(i)).toContainText(LABEL[cabin.cabinClass]);
    await expect(cabins.nth(i)).toContainText(cabin.soldOut ? "No seats left" : `${cabin.seatsRemaining} seats left`);
  }
});

// source: Excel GEN-06 flight times in each airport's local time zone
test("shows departure and arrival in local time", async ({ page }) => {
  const flight = await demoFlight(page.request);
  await page.goto(`/flights/${flight.id}`);
  await expect(page.getByText(/Local time/)).toHaveCount(2);
});

// source: spec P-13 "Book" button; team leader 26 Nov: P-13 sends cabinClass only
test("Book on a cabin opens P-14 with that cabin", async ({ page }) => {
  const flight = await demoFlight(page.request);
  const open = flight.cabins.find((c) => !c.soldOut)!;
  await page.goto(`/flights/${flight.id}`);
  await expect(page.getByRole("link", { name: `Book ${LABEL[open.cabinClass]}` })).toHaveAttribute(
    "href",
    `/flights/${flight.id}/book?cabinClass=${open.cabinClass}`,
  );
});

// source: Excel GEN-16 understandable errors (unknown flight -> the app's not-found page)
test("an unknown flight id shows the not-found page", async ({ page }) => {
  await page.goto("/flights/665f1c2a9b1e8a00123400a1");
  await expect(page.getByText("Error 404")).toBeVisible(); // the app's not-found page (spec 3.12)
  await expect(page.getByRole("region", { name: "Cabins and fares" })).toHaveCount(0);
});

// source: Excel GEN-16 responsive
test("no horizontal overflow at 375 px", async ({ page }) => {
  const flight = await demoFlight(page.request);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`/flights/${flight.id}`);
  await expect(page.getByRole("region", { name: "Cabins and fares" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
