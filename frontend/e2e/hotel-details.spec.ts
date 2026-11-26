// P-18 Hotel details (/hotels/[id]) against the real backend, read-only (nothing is held or written).
// Needs the demo data (npm run seed:demo). Dates are looked up first: the demo rooms are open only in their
// availability ranges and other runs may hold rooms, so the dates are scanned instead of fixed.
import { expect, test, type APIRequestContext } from "@playwright/test";

type Room = { id: string; roomNumber: string; type: string };

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

/** Demo Hotel Cairo and the first 2-night stay in the next 120 days with at least `count` free rooms (HTL-15). */
async function freeStay(request: APIRequestContext, count: number) {
  for (let start = 7; start < 120; start += 2) {
    const [checkIn, checkOut] = [day(start), day(start + 2)];
    const search = await request.get(`/api/hotels/search?city=cairo&checkIn=${checkIn}&checkOut=${checkOut}&guests=1`);
    const hotel = ((await search.json()) as { items: { id: string; name: string }[] }).items.find((h) => h.name === "Demo Hotel Cairo");
    if (!hotel) continue;
    const res = await request.get(`/api/hotels/${hotel.id}/rooms/available?checkIn=${checkIn}&checkOut=${checkOut}&page=1`);
    const rooms = ((await res.json()) as { items: Room[] }).items;
    if (rooms.length >= count) return { hotelId: hotel.id, checkIn, checkOut, rooms };
  }
  throw new Error(`Demo Hotel Cairo has no 2-night stay with ${count} free rooms in the next 120 days: run npm run seed:demo`);
}

// source: Excel HTL-15 - with dates, the free rooms of the hotel are listed
test("lists every free room for the dates", async ({ page }) => {
  const { hotelId, checkIn, checkOut, rooms } = await freeStay(page.request, 1);
  await page.goto(`/hotels/${hotelId}?checkIn=${checkIn}&checkOut=${checkOut}`);
  for (const room of rooms.slice(0, 10)) await expect(page.getByLabel(`Room ${room.roomNumber} · ${room.type}`)).toBeVisible();
});

// source: team leader 26 Nov (P-18) - several rooms are ticked, "Book selected rooms" opens P-19 with
// /hotels/{id}/book?checkIn=&checkOut=&roomIds=id1,id2 in list order; HTL-16 one or more rooms of one hotel
test("Book selected rooms is disabled until a room is ticked, then opens P-19 with the rooms in list order", async ({ page }) => {
  const { hotelId, checkIn, checkOut, rooms } = await freeStay(page.request, 2);
  await page.goto(`/hotels/${hotelId}?checkIn=${checkIn}&checkOut=${checkOut}`);
  const book = page.getByRole("button", { name: "Book selected rooms" });
  await expect(book).toBeDisabled();
  await page.getByLabel(`Room ${rooms[1].roomNumber} · ${rooms[1].type}`).click();
  await page.getByLabel(`Room ${rooms[0].roomNumber} · ${rooms[0].type}`).click();
  await book.click();
  // A guest is then sent to log in (ACC-10); the P-19 link is kept either way.
  await page.waitForURL(/\/(hotels\/.+\/book|login)/);
  const target = new URL(page.url()).pathname === "/login" ? new URL(page.url()).searchParams.get("returnTo")! : page.url().replace(/^https?:\/\/[^/]+/, "");
  expect(decodeURIComponent(target)).toBe(`/hotels/${hotelId}/book?checkIn=${checkIn}&checkOut=${checkOut}&roomIds=${rooms[0].id},${rooms[1].id}`);
});

// source: Excel GEN-16 - errors are understandable; team leader 26 Nov: a 400 on the dates shows the backend message
test("check-out before check-in shows the backend's message", async ({ page }) => {
  const { hotelId, checkIn, checkOut } = await freeStay(page.request, 1);
  const res = await page.request.get(`/api/hotels/${hotelId}/rooms/available?checkIn=${checkOut}&checkOut=${checkIn}&page=1`);
  expect(res.status()).toBe(400);
  const { message } = (await res.json()) as { message: string };
  await page.goto(`/hotels/${hotelId}?checkIn=${checkOut}&checkOut=${checkIn}`);
  await expect(page.getByRole("alert").filter({ hasText: "We couldn't load the rooms for these dates" })).toContainText(message);
});

// source: Excel HTL-02 - the hotel profile is public; without dates there are no rooms to list (HTL-15 needs dates)
test("without dates the page links to hotel search", async ({ page }) => {
  const { hotelId } = await freeStay(page.request, 1);
  await page.goto(`/hotels/${hotelId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Demo Hotel Cairo" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Search hotels" })).toHaveAttribute("href", "/hotels");
});

// source: Excel HTL-24 / GEN-04 - reviews are listed; team leader 26 Nov: empty list says "No reviews yet"
test("the reviews section shows the reviews or No reviews yet", async ({ page }) => {
  const { hotelId } = await freeStay(page.request, 1);
  const total = ((await (await page.request.get(`/api/hotels/${hotelId}/reviews?page=1`)).json()) as { total: number }).total;
  await page.goto(`/hotels/${hotelId}`);
  if (total === 0) await expect(page.getByText("No reviews yet")).toBeVisible();
  else await expect(page.getByText("No reviews yet")).toHaveCount(0);
});

// source: Excel GEN-16 - responsive on desktop and mobile
test("no horizontal overflow at 375 px", async ({ page }) => {
  const { hotelId, checkIn, checkOut } = await freeStay(page.request, 1);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`/hotels/${hotelId}?checkIn=${checkIn}&checkOut=${checkOut}`);
  await expect(page.getByRole("button", { name: "Book selected rooms" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
