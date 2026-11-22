# Frontend (Milestone 2)

Next.js (App Router) + React + TypeScript, the View of the MVC design (project description section 1.1).
Deadline 11 Dec 2026. Design rules: [`design-system/yallaway/MASTER.md`](../design-system/yallaway/MASTER.md).

## Run it

```bash
cd frontend
npm install
npm run dev          # http://localhost:3001  (the backend stays on :3000)
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 3001 |
| `npm run build` | Production build (must pass before a PR) |
| `npm run lint` | ESLint, including the "no raw colors / no inline styles in pages" rule |
| `npm run typecheck` | TypeScript check |

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

**Base components** (`@/components/ui/...`, shadcn/ui, already themed): `Button`, `Input`, `Textarea`, `Label`,
`Select`, `Checkbox`, `RadioGroup`, `Switch`, `ToggleGroup`, `Card`, `Dialog`, `AlertDialog`, `Sheet`,
`DropdownMenu`, `Popover`, `Tooltip`, `Tabs`, `Table`, `Skeleton`, `Avatar`, `Badge`, `Separator`, `Calendar`,
`Command` (searchable lists, e.g. airports), `Breadcrumb`, `ScrollArea`, and toasts via `toast` from `sonner`.
Add another shadcn component with `npx shadcn@4.23.0 add <name>` and tune it to MASTER.md the same way.

**Helpers** (`@/lib/...`): `format.ts` (money, dates, countdown), `api-error.ts` (`fieldErrorMap`), `session.ts`
(`SessionUser` from `/auth/me`), `nav.ts` (menus, home page per role).

**Area components** (flight result card, seat map, availability grid, tiers editor, image uploader, budget
summary, post editor...) are built by each area **from these parts**, in `src/components/app/`, following
MASTER.md section 6.2.

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
| Send every API call with the cookies: `fetch(url, { credentials: 'include' })`. | Store a token, a password or the user object in `localStorage`, `sessionStorage`, IndexedDB or a non-httpOnly cookie. |
| Get the logged-in account from `GET /api/auth/me` and keep it only in memory (React state, context, or a server fetch per request). | Read `document.cookie` for auth, or put a token in a URL, a header you build yourself, or a log. |
| Treat **401** as "not logged in": clear the in-memory user and go to login (then back to the action, ACC-10). | Cache `/api/auth/me` or `/api/users/me` responses yourself (for example with ISR or a service worker). |
| Log out with `POST /api/auth/logout`; it revokes the session and clears both cookies (the profile menu already does this). | Keep the password field's value after the login request. |
| If `mustChangePassword` is true in `/auth/me`, send the user to the change-password page (ACC-07a, ACC-13). | |

The cookies are `Secure`: Chrome and Edge accept them on `http://localhost`, Safari does not. Calling the
API from the browser and from server-rendered pages needs the same-origin setup (Next.js forwarding `/api`
and `/uploads` to the backend); it comes in its own branch, separately from the kit.
