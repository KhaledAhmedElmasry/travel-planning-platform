# Rendering strategy

The project description (section 9) asks for different rendering strategies on different pages, not one
strategy for the whole app, and says: "Students must justify their rendering decisions during evaluation."
This file is that justification: the four strategies we use, why each page uses the one it does, and the
proof that the build really does it. Every page also states its strategy in its own header comment
(`// Rendering: ...`), which is where this table comes from.

Checked on 24 Nov 2026 against `develop` `542333a`: `next build` route table, and the response headers of a
production server (`next start`) with the backend running.

## The four strategies

| Strategy | What Next.js does | In our code | How to see it |
|---|---|---|---|
| **Static** | Renders the page once, at build time. Every visitor gets the same HTML. | No request data is read on the server (no cookies, no search params). | Build: `○`. Header: `Cache-Control: s-maxage=31536000` |
| **ISR** (Incremental Static Regeneration) | Serves the cached page to everyone. After 60 s the next visit triggers a new render in the background. The backend can also refresh it at once (on-demand revalidation). | `export const revalidate = 60`; backend calls made with `fetch(..., { next: { revalidate, tags } })` and **without cookies**; `POST /revalidate` refreshes a tag (`post:<id>`, `itinerary:<id>`, `author:<id>`). | Build: `○` with Revalidate `1m`, or `●` for `[id]` pages. Header: `s-maxage=60, stale-while-revalidate`, `x-nextjs-cache: HIT` / `STALE` |
| **Dynamic SSR** | Renders the page on the server for every request. | The page reads the session cookie (`requireUser()`, `getSessionUser()`), the search params, or data that must be fresh. | Build: `ƒ`. Header: `Cache-Control: private, no-cache, no-store` |
| **Client Components** | Parts of a page that run in the browser. The page around them is still rendered on the server. | `"use client"` only on components that need clicks, state, timers or browser APIs. | The component file starts with `"use client"` |

Next.js "Cache Components" is off (not enabled in `next.config.ts`), so classic ISR (`export const revalidate`) works as
section 9 describes.

## Why each page uses its strategy

**ISR: published blog post, public author page, public itinerary (section 9), and the home page.**
These pages look the same for every visitor, are read far more often than they change, and must be found
by search engines (SEO metadata, sitemap). Serving the cached page is fast and spares the backend.
- Staleness is controlled from the backend. When an author edits, hides, deletes or makes an item private,
  or an admin hides it or deactivates the author, the backend calls `POST /revalidate` with the item's tag
  (backend `RevalidationService`, frontend `src/app/revalidate/route.ts`). So hidden content disappears at
  once (GEN-10, ACC-12). The 60-second timer is only a safety net if that call fails.
- The HTML is shared, so it cannot contain the visitor's session. The header finds out in the browser
  who is logged in (`SiteHeader` calls `GET /api/auth/me`). Actions like Clone, Save and Report are small
  Client Components.
- Home page (not in section 9, team choice): the same search box, featured itineraries and destinations
  for everyone. Featured itineraries may be up to a minute old.
- `/itineraries/[id]` shows as `●` with no Revalidate value in the build table. It still uses ISR:
  `generateStaticParams` returns an empty list, so no itinerary is rendered at build time. Each one is
  rendered on its first visit, then cached for 60 s (headers below).

**Dynamic SSR: search pages, private pages, dashboards (section 9).**
- *Blog listing / search, public itinerary search, flight / hotel search:* the result depends on the query
  string. Flight seats and hotel rooms also change every minute because of the 10-minute holds (FLT-22,
  HTL-18), so a cached list could show a seat or room that is already taken.
- *Flight details and hotel details* (public, not in section 9, team choice): the same reason. Free seats
  and rooms must be fresh, so these pages are rendered per request, with SEO metadata.
- *User booking pages, private itinerary, profile, notifications, favourites, user home, checkout:* the
  data belongs to one user. The server reads the session cookie and calls the backend as that user, so
  the page can never be shared or cached.
- *Admin and moderator dashboards:* the same reason, plus they must show the current state.
- *Verify email, no access:* they check the URL token or the session on every request.

**Dynamic SSR + Client Components: editors and interactive pages (section 9).**
Blog editor and drafts, itinerary editor, the payment page, and the dashboard forms. The server renders
the page with the user's data; the parts the user works with (forms, drag-and-drop days, dialogs, the hold
countdown) are Client Components. On the payment page the Stripe card field must run in the browser, so
card data never reaches our backend (PAY-01).

**Client Components: likes and comments (section 9).** They change on a click and only for the clicking
user, so they run in the browser inside the ISR post page.

**Static: log in, sign up, forgot / reset password, terms, kit, resume session** (not in section 9, team
choice). They are the same for everyone and read no user data on the server. Only the form is a Client
Component, and it submits from the browser.

## Proof from a running production server

| Page | Strategy | `x-nextjs-cache` | `Cache-Control` |
|---|---|---|---|
| `/` | ISR | `HIT` | `s-maxage=60, stale-while-revalidate=31535940` |
| `/itineraries/<id>` | ISR | `STALE` (served from cache, re-rendered in the background) | `s-maxage=60, stale-while-revalidate=31535940` |
| `/login`, `/terms` | Static | `HIT` | `s-maxage=31536000` |
| `/itineraries`, `/verify-email` | Dynamic SSR | (none) | `private, no-cache, no-store, max-age=0, must-revalidate` |

To check again: `cd frontend && npm run build` (route table at the end), then `npm start` and
`curl -sI http://localhost:3001/<page>`.

## Every page

`State`: **built** = the page is done. **stub** = not built yet (a teammate's page). For a stub, the strategy
is the plan written in its header. The build column shows today's placeholder: a stub that reads nothing yet
shows `○`, even when it will become `ƒ` once it reads the session. These rows are checked again when the
pages are built. All 25 built pages match their strategy.

Build symbols: `○` static, `●` static with `generateStaticParams`, `ƒ` dynamic (server-rendered per request).

| Route | Page | State | Strategy | Why (source) | `next build` |
|---|---|---|---|---|---|
| `/` | Home page (guest landing) | built | ISR / Static | Team choice: same page for every visitor, fast and good for SEO; featured itineraries may be a few minutes old | ○ static, revalidate 1m |
| `/account` | P-05, P-06 Profile | built | Dynamic SSR + Client Components | Team choice: per-user data read with the session cookie on every request, so it can't be cached for everyone; the edit form and the deactivate dialog are Client Components | ƒ dynamic |
| `/account/password` | P-03, P-04 Change password | built | Dynamic SSR + Client Components | Team choice: per-user data read with the session cookie on every request, so it can't be cached for everyone (requireUser also routes forced password changes here); the form is a Client Component | ƒ dynamic |
| `/admin` | Admin overview | built | Dynamic SSR | §9 "Admin / Moderator Dashboards" | ƒ dynamic |
| `/admin/accounts` | P-48 Accounts | stub | Dynamic SSR + Client Components | §9 "Admin / Moderator Dashboards" | ○ static |
| `/admin/analytics` | (Bonus) Analytics | stub | Dynamic SSR | §9 "Admin / Moderator Dashboards" | ○ static |
| `/admin/audit-log` | P-53 Audit log | stub | Dynamic SSR | §9 "Admin / Moderator Dashboards" | ○ static |
| `/admin/bookings` | P-51 All bookings | stub | Dynamic SSR | §9 "Admin / Moderator Dashboards" | ○ static |
| `/admin/moderators/new` | P-49 Create moderator | stub | Dynamic SSR + Client Components | §9 "Admin / Moderator Dashboards" | ○ static |
| `/admin/providers` | P-50 Providers | stub | Dynamic SSR + Client Components | §9 "Admin / Moderator Dashboards" | ○ static |
| `/admin/reports` | P-52 Reports | stub | Dynamic SSR + Client Components | §9 "Admin / Moderator Dashboards" | ○ static |
| `/airline` | Airline overview | built | Dynamic SSR | §9 "Admin / Moderator Dashboards" | ƒ dynamic |
| `/airline/baggage-policy` | P-40 Baggage policy | stub | Dynamic SSR + Client Components | §9 "Admin / Moderator Dashboards" | ○ static |
| `/airline/cancellation-policy` | P-41 Cancellation policy | stub | Dynamic SSR + Client Components | §9 "Admin / Moderator Dashboards" | ○ static |
| `/airline/flights` | P-36 Flights | stub | Dynamic SSR | §9 "Admin / Moderator Dashboards" | ○ static |
| `/airline/flights/[id]` | P-38 Manage flight | stub | Dynamic SSR + Client Components | §9 "Admin / Moderator Dashboards" | ƒ dynamic |
| `/airline/flights/[id]/bookings` | P-39 Flight bookings | stub | Dynamic SSR | §9 "Admin / Moderator Dashboards" | ƒ dynamic |
| `/airline/flights/new` | P-37 Create flight | stub | Dynamic SSR + Client Components | §9 "Admin / Moderator Dashboards" | ○ static |
| `/airline/profile` | P-35 My airline | stub | Dynamic SSR + Client Components | §9 "Admin / Moderator Dashboards" | ○ static |
| `/authors/[id]` | P-32 Author | stub | ISR / Static | §9 "Public Author Page" | ƒ dynamic |
| `/blog` | P-29 Blog | stub | Dynamic SSR | §9 "Blog Listing / Search" | ○ static |
| `/blog/[id]` | P-30 Post | stub | ISR / Static + Client Components | §9 "Published Blog Post" + "Likes and Comments" | ƒ dynamic |
| `/blog/tags/[tag]` | P-31 Posts by tag | stub | Dynamic SSR | §9 "Blog Listing / Search" | ƒ dynamic |
| `/bookings` | P-20, P-22 My bookings | built | Dynamic SSR | §9 "User Booking Pages" | ƒ dynamic |
| `/bookings/flights/[id]` | P-21 Flight booking details | built | Dynamic SSR | §9 "User Booking Pages"; cancel / change-flight / seat dialogs are Client Components | ƒ dynamic |
| `/bookings/hotels/[id]` | P-23 Hotel reservation details | built | Dynamic SSR | §9 "User Booking Pages"; the cancel dialog and the review section are Client Components | ƒ dynamic |
| `/checkout/[type]/[bookingId]` | P-16 Payment | built | Dynamic SSR + Client Components | Team choice: per-user data read with the session cookie on every request, so it can't be cached for everyone; Stripe Elements must run in the browser so card data never reaches the backend (PAY-01) | ƒ dynamic |
| `/checkout/[type]/[bookingId]/done` | P-17 Booking confirmed | built | Dynamic SSR | Team choice: per-user data read with the session cookie on every request, so it can't be cached for everyone (the booking reference); closest .md section 9 row: "User Booking Pages" | ƒ dynamic |
| `/favourites` | (Bonus) Favourites | built | Dynamic SSR | Team choice: per-user data read with the session cookie on every request, so it can't be cached for everyone | ƒ dynamic |
| `/flights` | P-12 Flight search | stub | Dynamic SSR | §9 "Flight / Hotel Search" | ○ static |
| `/flights/[id]` | P-13 Flight details | stub | Dynamic SSR | Team choice: public, but seats remaining change every minute (10-minute holds), so the data must be fresh on every request | ƒ dynamic |
| `/flights/[id]/book` | P-14 Book a flight | stub | Dynamic SSR + Client Components | Team choice: per-user data read with the session cookie on every request, so it can't be cached for everyone; the multi-step form and the 10-minute hold countdown run in the browser | ƒ dynamic |
| `/forbidden` | forbidden | built | Dynamic SSR | Team choice: it reads the session cookie to link the account to its own home page | ƒ dynamic |
| `/forgot-password` | P-09 (Bonus) Forgot password | built | Static + Client Component form | Team choice: same page for every visitor and no per-user data on the server, so it is prerendered; the form is a Client Component that submits from the browser (if it reads the URL with useSearchParams, wrap it in <Suspense>, Next.js 16 docs) | ○ static |
| `/home` | Home (registered user) | built | Dynamic SSR | Team choice: per-user data read with the session cookie on every request, so it can't be cached for everyone (upcoming trips) | ƒ dynamic |
| `/hotel` | Hotel overview | built | Dynamic SSR | §9 "Admin / Moderator Dashboards" | ƒ dynamic |
| `/hotel/availability` | P-45 Availability calendar | stub | Dynamic SSR | §9 "Admin / Moderator Dashboards" | ○ static |
| `/hotel/policies` | P-46 Hotel policies | stub | Dynamic SSR + Client Components | §9 "Admin / Moderator Dashboards" | ○ static |
| `/hotel/profile` | P-42 My hotel | stub | Dynamic SSR + Client Components | §9 "Admin / Moderator Dashboards" | ○ static |
| `/hotel/reservations` | P-47 Reservations | stub | Dynamic SSR | §9 "Admin / Moderator Dashboards" | ○ static |
| `/hotel/reviews` | (Bonus) Reviews | stub | Dynamic SSR + Client Components | §9 "Admin / Moderator Dashboards" | ○ static |
| `/hotel/rooms` | P-43 Rooms | stub | Dynamic SSR + Client Components | §9 "Admin / Moderator Dashboards" | ○ static |
| `/hotel/rooms/[roomId]` | P-44 Room availability | stub | Dynamic SSR + Client Components | §9 "Admin / Moderator Dashboards" | ƒ dynamic |
| `/hotels` | P-15 Hotel search | stub | Dynamic SSR | §9 "Flight / Hotel Search" | ○ static |
| `/hotels/[id]` | P-18 Hotel details | stub | Dynamic SSR | Team choice: public, but the free rooms depend on the dates in the URL and change with every hold, so the data must be fresh on every request | ƒ dynamic |
| `/hotels/[id]/book` | P-19 Book a hotel | stub | Dynamic SSR + Client Components | Team choice: per-user data read with the session cookie on every request, so it can't be cached for everyone; the multi-step form and the 10-minute hold countdown run in the browser | ƒ dynamic |
| `/itineraries` | P-27 Explore itineraries | built | Dynamic SSR | §9 "Public Itinerary Search" | ƒ dynamic |
| `/itineraries/[id]` | P-28 Public itinerary | built | ISR / Static | §9 "Public Itinerary Detail" | ● static (SSG) |
| `/kit` | kit | built | Static | Team choice: the same demo content for everyone, built once; not linked and hidden from search | ○ static |
| `/login` | P-02 Log in | built | Static + Client Component form | Team choice: same page for every visitor and no per-user data on the server, so it is prerendered; the form is a Client Component that submits from the browser (if it reads the URL with useSearchParams, wrap it in <Suspense>, Next.js 16 docs) | ○ static |
| `/my/itineraries` | P-24 My itineraries | stub | Dynamic SSR | Team choice: per-user data read with the session cookie on every request, so it can't be cached for everyone (private itineraries); same reason as .md section 9 "Private Itinerary Detail" | ○ static |
| `/my/itineraries/[id]` | P-25, P-26 Itinerary editor | stub | Dynamic SSR + Client Components | §9 "Private Itinerary Detail" + "Itinerary Editor" | ƒ dynamic |
| `/my/itineraries/new` | P-25 New itinerary | stub | Dynamic SSR + Client Components | §9 "Itinerary Editor" | ○ static |
| `/my/posts` | P-33 My posts | stub | Dynamic SSR + Client Components | §9 "Blog Editor / Drafts" | ○ static |
| `/my/posts/[id]/edit` | P-34 Edit post | stub | Dynamic SSR + Client Components | §9 "Blog Editor / Drafts" | ƒ dynamic |
| `/my/posts/new` | P-34 New post | stub | Dynamic SSR + Client Components | §9 "Blog Editor / Drafts" | ○ static |
| `/notifications` | P-11 Notifications | built | Dynamic SSR + Client Components | Team choice: per-user data read with the session cookie on every request, so it can't be cached for everyone and must be fresh; mark-as-read buttons are Client Components | ƒ dynamic |
| `/reset-password` | P-10 (Bonus) Reset password | built | Static + Client Component form | Team choice: same page for every visitor and no per-user data on the server, so it is prerendered; the form is a Client Component that submits from the browser (if it reads the URL with useSearchParams, wrap it in <Suspense>, Next.js 16 docs); the reset token comes from the URL | ○ static |
| `/resume-session` | resume-session?returnTo=/bookings | built | Static + Client Component | Team choice: same page for everyone; the Client Component reads ?returnTo (useSearchParams inside <Suspense>) and calls the refresh from the browser so the new cookies are set there | ○ static |
| `/signup` | P-01 Sign up | built | Static + Client Component form | Team choice: same page for every visitor and no per-user data on the server, so it is prerendered; the form is a Client Component that submits from the browser (if it reads the URL with useSearchParams, wrap it in <Suspense>, Next.js 16 docs) | ○ static |
| `/terms` | Terms & Privacy | built | Static | Team choice: the same text for everyone, it only changes with a new deploy | ○ static |
| `/verify-email` | P-08 (Bonus) Verify email | built | Dynamic SSR | Team choice: the token in the URL is checked against the backend on every request; nothing to cache | ƒ dynamic |

Not pages, but part of the same picture: `/robots.txt` (static), `/sitemap.xml` (ISR, refreshed every 60 s,
lists every public itinerary), `/revalidate` (the route the backend calls for on-demand revalidation), and
the 404 and error pages (`not-found.tsx`, `error.tsx`, the error page is a Client Component as Next.js
requires).
