# Frontend (Milestone 2)

Next.js (App Router) + React + TypeScript, the View of the MVC design (project description section 1.1).
Deadline 11 Dec 2026. Design rules: [`design-system/yallaway/MASTER.md`](../design-system/yallaway/MASTER.md).

## Run it

```bash
# 1. the backend, in another terminal: cd backend && npm run start:dev   (http://localhost:3000)
cd frontend
npm install
cp .env.example .env.local   # BACKEND_URL=http://localhost:3000 (change it if your backend runs elsewhere)
npm run dev                  # http://localhost:3001
```

Always open the app at **http://localhost:3001** (not :3000): the frontend forwards `/api` and `/uploads`
to the backend, so the browser sees one site and the login cookies work. `BACKEND_URL` must be set both
when building and when running (`.env.local` covers both). Use Chrome or Edge locally: Safari refuses
`Secure` cookies on `http://localhost`.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 3001 |
| `npm run build` | Production build (must pass before a PR) |
| `npm run lint` | ESLint, including the "no raw colors / no inline styles in pages" rule |
| `npm run typecheck` | TypeScript check |
| `npm test` | Component tests (Vitest + React Testing Library), files `src/**/*.test.tsx` |
| `npm run test:e2e` | Whole pages in a real browser (Playwright), files `e2e/*.spec.ts`, desktop + phone. Start the backend first; it starts the frontend itself. First time: `npx playwright install chromium` |

Async Server Components (most pages) can't be rendered by Vitest (Next.js 16 testing guide): test them with Playwright.

### Email link tests (opt-in)

`e2e/email/` holds the tests that open the emailed links (ACC-02 verify email, ACC-07 reset password).
They **create accounts**, so `npm run test:e2e` skips them. Run them only against a backend that uses a
**throwaway database**, never the shared one:

1. Start the backend with a throwaway database and its output in a file, e.g. in `backend/`:
   `MONGODB_URI=<shared URI with the db name changed to tp_e2e_<time>> NODE_ENV=development node dist/main.js > e2e-backend.log`
   (outside production the backend prints every emailed link in its log).
2. Point the frontend at it (`BACKEND_URL` in `frontend/.env.local`) and set `E2E_BACKEND_LOG` to the full path of that log file.
3. `npm run test:e2e:email`. Without `E2E_BACKEND_LOG` the tests stop at once, before creating anything.
4. Afterwards drop the `tp_e2e_<time>` database.

Open **http://localhost:3001/kit** to see every ready-made component with sample data and the code to use it.

## The kit: you don't style anything

The look of the whole app (colors, font, spacing, corners, focus rings, loading and error states) is already
built into ready-made components. A page imports them and passes props. That keeps every page consistent
(GEN-17) and saves everyone the styling work.

```tsx
// src/app/bookings/[id]/page.tsx   P-21 Flight booking details: FLT-25, FLT-26, PAY-03
<AppShell user={user}>
  <PageHeader title={`Booking ${b.reference}`} back={{ href: "/bookings", label: "My bookings" }} />
  <StatusBadge kind="booking" status={b.status} />
  <Price cents={b.totalAmount} currency={b.currency} size="lg" />
  <ConfirmDialog
    trigger={<Button variant="destructive">Cancel booking</Button>}
    title="Cancel this booking?"
    description={`You get ${refundText} back.`}
    confirmLabel="Cancel booking"
    onConfirm={cancel}
  />
</AppShell>
```

### Rules (the linter enforces 1 and 2 in `src/app`)

1. **No colors of your own.** No `text-purple-500`, `bg-white`, `bg-[#6E56B8]`. Use a component, or a theme
   token when you really need one: `bg-card`, `bg-muted`, `text-muted-foreground`, `text-subtle-foreground`,
   `text-link`, `text-cyan`, `text-success`, `text-warning`, `text-error`, `border-border`.
2. **No `style={{...}}`.**
3. **Layout classes are fine in pages:** `grid`, `flex`, `gap-*`, `grid-cols-*`, `mt-*`, `max-w-*`, `hidden md:block`.
4. **Every page uses a shell** (below). Never build your own header, sidebar or footer.
5. **Money:** `<Price cents currency>` for bookings, payments and refunds (integer cents, one platform currency,
   never converted, PAY-04). `<BudgetAmount amount currency>` for itinerary budgets (decimals, ITN-18).
6. **Flight times:** `<LocalTime iso timeZone airport>`, always the airport's own time zone (GEN-06).
7. **Statuses:** `<StatusBadge kind status>` with the value exactly as the API sends it (GEN-11).
8. **Forms:** every input inside `<FormField>`; show the backend's errors with `fieldErrorMap()` (GEN-02).
9. **Lists:** `<PaginationBar>` for anything longer than 10 (GEN-05) and `<EmptyState>` when empty (GEN-04).
10. **Destructive actions:** `<ConfirmDialog>` (GEN-03). Results of actions: `toast.success()` / `toast.error()` (GEN-16).
11. **Each page designs 4 states:** loading (`<Skeleton>`), empty (`<EmptyState>`), error (`<ErrorState>`), success (toast).
12. Put the page id and requirement ids in a comment at the top of the page file.
13. Frontend checks only mirror the backend; the backend stays the real protection (GEN-13, .md section 7.2).

Need something the kit doesn't have? Build it in `src/components/app/` from kit parts and theme tokens
(the lint rule allows that folder), or ask the team leader first.

### What's in the kit

**Shells** (`@/components/layout/...`)

| Component | Use for |
|---|---|
| `PublicShell` | Guest and public pages (home, search, blog, public itineraries). Pass `user` when logged in. |
| `AppShell` | Logged-in traveler pages (bookings, itineraries, posts, profile, booking wizard) |
| `DashboardShell` | Airline moderator, hotel moderator and admin pages (sidebar from `src/lib/nav.ts`) |
| `AuthLayout` | Sign up, log in, password pages |
| `WizardLayout` | Inside `AppShell`: stepper + step content + side column (hold timer, summary) |

Menus for every role live in [`src/lib/nav.ts`](src/lib/nav.ts); add a line there to make a new page appear.

**Yallaway components** (`@/components/app/...`)

| Component | Requirement |
|---|---|
| `PageHeader` (h1, description, actions, back link) | GEN-14 |
| `FormField`, `FormErrorSummary`, `PasswordInput`, `NumberStepper` | GEN-02, ACC-01, FLT-11, HTL-11 |
| `StatusBadge` | GEN-11, PAY-01, PAY-03, FLT-30, HTL-08, ACC-15, BLG-03, GEN-10 |
| `Price`, `BudgetAmount`, `LocalTime` | PAY-04, ITN-18, GEN-06 |
| `EmptyState`, `ErrorState`, `ConfirmDialog` | GEN-04, GEN-16, GEN-03 |
| `HoldCountdown`, `Stepper` | FLT-22, HTL-18, PAY-01 |
| `DataTable`, `PaginationBar`, `StatCard` | ACC-14, ACC-17, GEN-05, GEN-07 |
| `So3ad` (mascot, poses `wave` and `sit`) | MASTER.md section 9 |
| `DatePicker`, `DateRangePicker`, `DateTimePicker`, `TimeInput` | ITN-01, HTL-11, HTL-04, FLT-03, HTL-09 |
| `MultiSelect`, `TagInput` | ITN-01, BLG-01, BLG-08 |
| `ImageUploader` | GEN-08 |
| `TiersEditor` + `validateTiers()` | FLT-09, HTL-10 |
| `ReportButton` | GEN-09 |
| `BarChart` (with table view) | ITN-14, BON-01 |

**Base components** (`@/components/ui/...`, shadcn/ui, already themed): `Button`, `Input`, `Textarea`, `Label`,
`Select`, `Checkbox`, `RadioGroup`, `Switch`, `ToggleGroup`, `Card`, `Dialog`, `AlertDialog`, `Sheet`,
`DropdownMenu`, `Popover`, `Tooltip`, `Tabs`, `Table`, `Skeleton`, `Avatar`, `Badge`, `Separator`, `Calendar`,
`Command` (searchable lists, e.g. airports), `Breadcrumb`, `ScrollArea`, and toasts via `toast` from `sonner`.
Add another shadcn component with `npx shadcn@4.23.0 add <name>` and tune it to MASTER.md the same way.

**Helpers** (`@/lib/...`): `format.ts` (money, dates, countdown), `dates.ts` (`YYYY-MM-DD` strings, nights),
`api-error.ts` (`fieldErrorMap`), `session.ts` (`SessionUser` from `/auth/me`), `nav.ts` (menus, home page per role).

**Area components** (flight result card, seat map, availability grid, budget summary, post editor, passenger
card...) are built by each area **from these parts**, in `src/components/app/`, following MASTER.md section 6.2
(the "Area" rows).

## Rendering (project description section 9)

Don't use one strategy for the whole app; each choice is justified at evaluation.

| Page | Strategy |
|---|---|
| Published blog post, public author page, public itinerary | ISR / static (`export const revalidate = ...`) + SEO metadata |
| Blog listing/search, public itinerary search, flight/hotel search, booking pages, private itinerary, dashboards | Dynamic SSR |
| Blog editor/drafts, itinerary editor | Dynamic SSR + Client Components |
| Likes and comments | Client Components |

The app was created with Next.js "Cache Components" turned off, so classic ISR (`export const revalidate`)
works as written above. Add `"use client"` only to components that need the browser (clicks, state, timers).
Kit display components (`Price`, `StatusBadge`, `LocalTime`, `PageHeader`, `EmptyState`) work in Server Components.

## Requirements done only in the frontend

These mandatory requirements have no backend work (or only the small backend part noted):

| Requirement | What the frontend must do |
|---|---|
| ACC-10 | Send a guest who tries a restricted action to login, then back to that action (backend returns 401). |
| GEN-02 | Show the backend's field-level validation messages next to each form field (`FormField`). |
| GEN-03 | Ask for confirmation before destructive actions (`ConfirmDialog`). |
| GEN-04 | Show friendly empty states when a list or search has no results (`EmptyState`). |
| GEN-14 | Clear information architecture and navigation; users can go back or cancel without losing data. |
| GEN-15 | Intuitive, easy-to-learn interface with clearly visible actions. |
| GEN-16 | Loading, success and error states; responsive on desktop, tablet and mobile. |
| GEN-17 | Consistent colours, typography, spacing and component styling (the kit). |

## Sessions and tokens (ACC-19)

The backend already does its part: `POST /api/auth/login` sets the `access_token` and
`refresh_token` cookies as httpOnly, Secure, SameSite=Strict, tokens are never in a response body,
and every auth and profile response has `Cache-Control: no-store`. The frontend must keep it that
way:

| Do | Never |
|---|---|
| Call the API with the helpers below (they send the cookies and handle 401). | Store a token, a password or the user object in `localStorage`, `sessionStorage`, IndexedDB or a non-httpOnly cookie. |
| Get the logged-in account with `getSessionUser()` / `requireUser()` (server) and keep it only in memory. | Read `document.cookie` for auth, or put a token in a URL, a header you build yourself, or a log. |
| Let `apiFetch` handle **401**: it refreshes once, then sends the user to login and back (ACC-10). | Cache `/api/auth/me` or `/api/users/me` responses yourself (for example with ISR or a service worker). |
| Log out with `POST /api/auth/logout` (the profile menu already does this). | Keep the password field's value after the login request. |
| `requireUser()` already sends accounts with `mustChangePassword` to `/account/password` (ACC-07a, ACC-13). | |

How the cookies travel: the backend sets `access_token` on path `/` (so page requests carry it and
server-rendered pages know the user) and `refresh_token` on `/api/auth` only (refresh and logout).
Both are httpOnly, Secure, SameSite=Strict. The access token lasts 15 minutes; the session ends after
30 minutes without activity (ACC-06).

## Calling the backend

**Server pages** (Server Components, the default):

```tsx
import { requireUser, getSessionUser, getUnreadCount } from "@/lib/server/session";
import { backendFetch, backendJson } from "@/lib/server/backend";

// a page only travelers may open (P-20 My flight bookings)
export default async function MyBookingsPage() {
  const user = await requireUser(["user"]);          // guests -> login and back, others -> /forbidden
  const data = await backendJson<Paginated<FlightBooking>>("/api/flight-bookings?group=upcoming");
  return <AppShell user={user} unreadNotifications={await getUnreadCount()}>...</AppShell>;
}

// a public page that changes when someone is logged in
const user = await getSessionUser();                  // SessionUser | null
```

- `requireUser(roles)`: no session -> `/resume-session` (refreshes once if the access token expired)
  -> back to the page, or `/login?returnTo=...`; wrong role -> `/forbidden`; temporary password ->
  `/account/password` (that page calls `requireUser([...], { allowPendingPasswordChange: true })`).
- `backendFetch(path)` / `backendJson(path)`: call the backend with the visitor's cookies, never cached.
- **Public ISR pages** (published post, author page, public itinerary): don't call these (they read
  cookies, which makes the page dynamic). Use `fetch(\`${BACKEND_URL}/api/...\`, { next: { revalidate: 300 } })`
  without cookies, and use `<PublicShell>` **without** `user`: the header then checks the session in the
  browser, so the cached page still shows each visitor their own menu.

**Browser code** (Client Components: forms, buttons, wizard steps):

```tsx
import { apiFetch, ApiError } from "@/lib/api";
import { fieldErrorMap } from "@/lib/api-error";

try {
  const booking = await apiFetch<FlightBooking>("/api/flight-bookings/hold", { method: "POST", json: body });
  toast.success("Seats held for 10 minutes.");
} catch (error) {
  if (error instanceof ApiError) setErrors(fieldErrorMap(error.body)); // GEN-02
}
```

- Same origin: always `"/api/..."`, never `http://localhost:3000`.
- 401 -> one refresh + retry (one at a time, even across tabs: reusing a rotated refresh token would end
  the session) -> still 401 -> login with `returnTo` (pass `{ redirectOnAuthFail: false }` to handle it).
- File uploads: `apiFetch(path, { method: "POST", body: formData })`.

**After login** (the login page, P-02): go to `afterLoginPath(user.role, searchParams.get("returnTo"))`
from `@/lib/return-to`: back to the action (ACC-10) or the role's home page (ACC-04). It accepts only
local paths, so `returnTo` can't send users to another site.
