// Responsive check of every page (Excel GEN-16: "responsive across desktop, tablet, and mobile screen sizes";
// .md section 7.2: "responsive public and authenticated pages"; MASTER.md section 3 "Breakpoints":
// "Design checks at 375, 768, 1024, 1440"). Each page is opened at the 4 widths, as the role it is for
// (demo accounts from npm run seed:demo, the admin from npm run seed), and fails when the page scrolls
// sideways. A full-page screenshot per width is saved in test-results/ for a check by eye.
// Nothing is created or changed: a page that needs a booking or an itinerary uses the first one the
// account already has; when there is none, the test says so in a "not checked" annotation.
// Runs in the "desktop" project only (playwright.config.ts): the widths are set here.
// Run: npm run test:e2e -- responsive.spec.ts
import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin, loginAsDemo } from "./support/login";

const WIDTHS = [375, 768, 1024, 1440]; // MASTER.md section 3, "Design checks at"
const HEIGHT = 900;
const SETTLE_MS = 1_000;

type Role = "guest" | "user" | "airline" | "hotel" | "admin";
// A path, or a function that finds the id the page needs (null = nothing to open on this database).
type Target = string | ((page: Page) => Promise<string | null>);
type Route = { name: string; as: Role; target: Target };

// Stub pages (not built yet) get a placeholder id; give them a real one in the final pass.
const PLACEHOLDER_ID = "665f1c2a9b1e8a00123400a1";

const LOGIN: Record<Exclude<Role, "guest">, (page: Page) => Promise<void>> = {
  user: (page) => loginAsDemo(page, "demo.user@yallaway.local"),
  airline: (page) => loginAsDemo(page, "demo.airline@yallaway.local"),
  hotel: (page) => loginAsDemo(page, "demo.hotel.cairo@yallaway.local"),
  admin: loginAsAdmin,
};

type Listed = { id: string; status?: string };

/** The path for the first item of a list endpoint (optionally with this status), as the logged-in account. */
function first(api: string, toPath: (item: Listed) => string, status?: string) {
  return async (page: Page): Promise<string | null> => {
    const res = await page.request.get(api);
    if (!res.ok()) return null;
    const { items } = (await res.json()) as { items: Listed[] };
    const item = items.find((i) => !status || i.status === status);
    return item ? toPath(item) : null;
  };
}

const ROUTES: Route[] = [
  // Public pages (guest)
  { name: "home", as: "guest", target: "/" },
  { name: "flight search", as: "guest", target: "/flights" },
  { name: "flight details", as: "guest", target: `/flights/${PLACEHOLDER_ID}` },
  { name: "hotel search", as: "guest", target: "/hotels" },
  { name: "hotel details", as: "guest", target: `/hotels/${PLACEHOLDER_ID}` },
  { name: "explore itineraries", as: "guest", target: "/itineraries" },
  { name: "public itinerary", as: "guest", target: first("/api/itineraries/public/search", (i) => `/itineraries/${i.id}`) },
  { name: "blog", as: "guest", target: "/blog" },
  { name: "blog post", as: "guest", target: `/blog/${PLACEHOLDER_ID}` },
  { name: "blog tag", as: "guest", target: "/blog/tags/travel" },
  { name: "author", as: "guest", target: `/authors/${PLACEHOLDER_ID}` },
  { name: "log in", as: "guest", target: "/login" },
  { name: "sign up", as: "guest", target: "/signup" },
  { name: "forgot password", as: "guest", target: "/forgot-password" },
  { name: "reset password", as: "guest", target: "/reset-password?token=x" },
  { name: "verify email", as: "guest", target: "/verify-email?token=x" },
  { name: "terms", as: "guest", target: "/terms" },
  { name: "component kit", as: "guest", target: "/kit" },
  { name: "no access", as: "guest", target: "/forbidden" },
  { name: "not found", as: "guest", target: "/no-such-page" },
  // Registered user
  { name: "user home", as: "user", target: "/home" },
  { name: "profile", as: "user", target: "/account" },
  { name: "change password", as: "user", target: "/account/password" },
  { name: "notifications", as: "user", target: "/notifications" },
  { name: "my bookings", as: "user", target: "/bookings" },
  { name: "flight booking", as: "user", target: first("/api/flight-bookings", (b) => `/bookings/flights/${b.id}`) },
  { name: "hotel reservation", as: "user", target: first("/api/hotel-bookings", (b) => `/bookings/hotels/${b.id}`) },
  { name: "payment", as: "user", target: first("/api/hotel-bookings", (b) => `/checkout/hotel/${b.id}`, "pending_payment") },
  { name: "confirmation", as: "user", target: first("/api/hotel-bookings", (b) => `/checkout/hotel/${b.id}/done`, "confirmed") },
  { name: "favourites", as: "user", target: "/favourites" },
  { name: "book a flight", as: "user", target: `/flights/${PLACEHOLDER_ID}/book` },
  { name: "book a hotel", as: "user", target: `/hotels/${PLACEHOLDER_ID}/book` },
  { name: "my itineraries", as: "user", target: "/my/itineraries" },
  { name: "new itinerary", as: "user", target: "/my/itineraries/new" },
  { name: "itinerary editor", as: "user", target: first("/api/itineraries", (i) => `/my/itineraries/${i.id}`) },
  { name: "my posts", as: "user", target: "/my/posts" },
  { name: "new post", as: "user", target: "/my/posts/new" },
  { name: "edit post", as: "user", target: `/my/posts/${PLACEHOLDER_ID}/edit` },
  // Airline moderator
  { name: "airline overview", as: "airline", target: "/airline" },
  { name: "airline flights", as: "airline", target: "/airline/flights" },
  { name: "new flight", as: "airline", target: "/airline/flights/new" },
  { name: "edit flight", as: "airline", target: `/airline/flights/${PLACEHOLDER_ID}` },
  { name: "flight bookings", as: "airline", target: `/airline/flights/${PLACEHOLDER_ID}/bookings` },
  { name: "airline profile", as: "airline", target: "/airline/profile" },
  { name: "baggage policy", as: "airline", target: "/airline/baggage-policy" },
  { name: "cancellation policy", as: "airline", target: "/airline/cancellation-policy" },
  // Hotel moderator
  { name: "hotel overview", as: "hotel", target: "/hotel" },
  { name: "hotel profile", as: "hotel", target: "/hotel/profile" },
  { name: "rooms", as: "hotel", target: "/hotel/rooms" },
  { name: "edit room", as: "hotel", target: `/hotel/rooms/${PLACEHOLDER_ID}` },
  { name: "availability", as: "hotel", target: "/hotel/availability" },
  { name: "hotel policies", as: "hotel", target: "/hotel/policies" },
  { name: "reservations", as: "hotel", target: "/hotel/reservations" },
  { name: "hotel reviews", as: "hotel", target: "/hotel/reviews" },
  // Admin
  { name: "admin overview", as: "admin", target: "/admin" },
  { name: "accounts", as: "admin", target: "/admin/accounts" },
  { name: "new moderator", as: "admin", target: "/admin/moderators/new" },
  { name: "providers", as: "admin", target: "/admin/providers" },
  { name: "all bookings", as: "admin", target: "/admin/bookings" },
  { name: "reports", as: "admin", target: "/admin/reports" },
  { name: "audit log", as: "admin", target: "/admin/audit-log" },
  { name: "analytics", as: "admin", target: "/admin/analytics" },
];

/** null when the page fits; otherwise the page width and the innermost elements that stick out. */
async function sidewaysOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const width = doc.clientWidth;
    if (doc.scrollWidth <= width) return null;
    // Inside a scroll or clip box (e.g. a wide table in overflow-x-auto) an element may be wider: it doesn't move the page.
    const inScrollBox = (el: Element) => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        if (getComputedStyle(a).overflowX !== "visible") return true;
      }
      return false;
    };
    const out = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.right > width + 1 && !inScrollBox(el);
    };
    const describe = (el: Element) => {
      const slot = el.getAttribute("data-slot");
      const cls = typeof el.className === "string" ? el.className.split(/\s+/).slice(0, 4).join(".") : "";
      const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
      return `${el.tagName.toLowerCase()}${slot ? `[data-slot=${slot}]` : ""}${cls ? `.${cls}` : ""} right=${Math.round(el.getBoundingClientRect().right)} "${text}"`;
    };
    const culprits = [...document.body.querySelectorAll("*")]
      .filter((el) => out(el) && ![...el.children].some(out))
      .slice(0, 5)
      .map(describe);
    return { scrollWidth: doc.scrollWidth, width, culprits };
  });
}

for (const route of ROUTES) {
  test(`${route.name} (${route.as}) fits 375-1440px without sideways scrolling`, async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    if (route.as !== "guest") await LOGIN[route.as](page);
    const path = typeof route.target === "string" ? route.target : await route.target(page);
    if (path === null) {
      testInfo.annotations.push({ type: "not checked", description: `the ${route.as} account has no item for "${route.name}"` });
      return;
    }

    const problems: string[] = [];
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: HEIGHT });
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      // Not "networkidle": a guest's session check leaves its refresh request open in Chromium. The
      // header fills in its login/user buttons right after load, so give it a moment before measuring.
      await page.waitForTimeout(SETTLE_MS);
      // A logged-in page that bounced to login or /forbidden would check the wrong page.
      if (route.as !== "guest") expect(new URL(page.url()).pathname, `${route.name} as ${route.as}`).toBe(path.split("?")[0]);
      await page.screenshot({ path: testInfo.outputPath(`${width}.png`), fullPage: true });
      const overflow = await sidewaysOverflow(page);
      if (overflow) {
        problems.push(`${width}px: page is ${overflow.scrollWidth}px wide (viewport ${overflow.width}px): ${overflow.culprits.join(" | ")}`);
      }
    }
    expect(problems, `${route.name} ${path}`).toEqual([]);
  });
}
