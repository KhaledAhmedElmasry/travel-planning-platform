// P-19 Book a hotel (/hotels/[id]/book) against the real backend as demo.user.
// Team leader (26 Nov): this spec makes a REAL hold on the database (one Pending Payment reservation per run
// and project; it expires by itself after 10 minutes, HTL-18). Needs the demo data (npm run seed:demo).
// The room and dates are looked up first, so a room still held by an earlier run is never picked.
import { expect, test, type APIRequestContext } from "@playwright/test";
import { loginAsDemo } from "./support/login";

type Room = { id: string; roomNumber: string; maxOccupancy: number; pricePerNight: number; nights: number; totalPrice: number };

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

/** Demo Hotel Cairo (demo seed) and the first 2-night stay in the next 120 days with at least `count` free rooms.
 *  The demo rooms are open only in their availability ranges, and an earlier run's holds take rooms away for
 *  10 minutes, so the dates are scanned instead of fixed. */
async function freeStay(request: APIRequestContext, count: number) {
  for (let start = 7; start < 120; start += 2) {
    const [checkIn, checkOut] = [day(start), day(start + 2)];
    const search = await request.get(`/api/hotels/search?city=cairo&checkIn=${checkIn}&checkOut=${checkOut}&guests=1`);
    const hotel = ((await search.json()) as { items: { id: string; name: string }[] }).items.find((h) => h.name === "Demo Hotel Cairo");
    if (!hotel) continue;
    const res = await request.get(`/api/hotels/${hotel.id}?checkIn=${checkIn}&checkOut=${checkOut}`);
    const rooms = ((await res.json()) as { availableRooms?: Room[] }).availableRooms ?? [];
    if (rooms.length >= count) return { hotelId: hotel.id, checkIn, checkOut, rooms: rooms.slice(0, count) };
  }
  throw new Error(`Demo Hotel Cairo has no 2-night stay with ${count} free rooms in the next 120 days: run npm run seed:demo`);
}

// source: Excel ACC-10 - a guest who tries a restricted action logs in first; HTL-16 actor Registered User
test("a guest who opens the booking page is sent to log in", async ({ page }) => {
  const { hotelId, checkIn, checkOut, rooms } = await freeStay(page.request, 1);
  await page.goto(`/hotels/${hotelId}/book?checkIn=${checkIn}&checkOut=${checkOut}&roomIds=${rooms[0].id}`);

  await expect(page).toHaveURL(/\/(resume-session|login)\?returnTo=/);
});

// source: team leader (26 Nov) - a room in ?roomIds= that is not free shows "No rooms available" and a way back
test("a room that is not free shows the empty state with a way back to the hotel", async ({ page }) => {
  const { hotelId, checkIn, checkOut } = await freeStay(page.request, 1);
  await loginAsDemo(page, "demo.user@yallaway.local");
  await page.goto(`/hotels/${hotelId}/book?checkIn=${checkIn}&checkOut=${checkOut}&roomIds=665f1c2a9b1e8a00123400a1`);

  await expect(page.getByText("No rooms available")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to the hotel" })).toHaveAttribute("href", `/hotels/${hotelId}?checkIn=${checkIn}&checkOut=${checkOut}`);
});

// source: Excel HTL-16 several rooms in one reservation, total = sum of nights x price; HTL-09 times; HTL-18 hold on
// Proceed to payment; PAY-02 policies before payment; spec P-19 steps; team leader (26 Nov) refresh goes to P-16
test("the chosen rooms go through Guests and Summary, are held together, and the policies follow", async ({ page }, testInfo) => {
  // The desktop and mobile projects run at the same time on the demo hotel's 3 rooms: desktop holds two
  // (several rooms in one reservation), mobile the third.
  const { hotelId, checkIn, checkOut, rooms: all } = await freeStay(page.request, 3);
  const rooms = testInfo.project.name === "mobile" ? all.slice(2, 3) : all.slice(0, 2);
  await loginAsDemo(page, "demo.user@yallaway.local");
  await page.goto(`/hotels/${hotelId}/book?checkIn=${checkIn}&checkOut=${checkOut}&roomIds=${rooms.map((r) => r.id).join(",")}`);

  // Step 1 Guests: one section per chosen room, one adult each by default.
  for (const r of rooms) await expect(page.getByRole("group", { name: `Room ${r.roomNumber}` })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2 Summary: nothing held yet.
  await expect(page.locator('li[aria-current="step"]')).toContainText("Summary");
  const summary = page.locator("section").filter({ has: page.getByRole("button", { name: "Proceed to payment" }) });
  await expect(summary).toContainText(`${checkIn} to ${checkOut}`);
  await expect(summary).toContainText(/Check-in from \d{2}:\d{2}; check-out by \d{2}:\d{2}\./);
  for (const r of rooms) await expect(summary).toContainText(`Room ${r.roomNumber}`);
  await expect(summary).toContainText("2 nights ×");

  // Proceed to payment: one real hold for all the rooms, then the policies with the acceptance checkbox.
  const hold = page.waitForResponse((res) => res.url().endsWith("/api/hotel-bookings") && res.request().method() === "POST");
  await page.getByRole("button", { name: "Proceed to payment" }).click();
  const created = await hold;
  expect(created.status()).toBe(201);
  const booking = (await created.json()) as { id: string; totalAmount: number };
  expect(booking.totalAmount).toBe(rooms.reduce((sum, r) => sum + r.totalPrice, 0));
  await expect(page.getByRole("checkbox")).toBeVisible();
  await expect(page.locator('li[aria-current="step"]')).toContainText("Policies");
  await expect(page).toHaveURL(new RegExp(`bookingId=${booking.id}`));

  // A refresh continues on the payment page of the same booking instead of holding again.
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/checkout/hotel/${booking.id}$`));
});
