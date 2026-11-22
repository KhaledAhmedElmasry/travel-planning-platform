# Yallaway Design System (MASTER)

> **Who this is for:** every team member building a Milestone 2 page, and any AI tool helping them.
> **Rule zero:** you do not style things. You import a ready-made component and pass props. If the component you need does not exist, ask the team leader before writing CSS.
> **Sources:** `MILESTONE2_FRONTEND_SPEC.md` (pages P-01…P-53), `docs/milestone1/Project description updated.md` (§1.1, §7.2, §9, §14), the Excel requirements (GEN-02…GEN-17).
> Page-specific overrides go in `design-system/yallaway/pages/<page>.md`. If a page file exists, it wins over this file for that page only.

Status: **approved by the team leader (22 Nov 2026)**, pending the visual review.

---

## 1. Decisions (locked)

| Topic | Decision |
|---|---|
| Framework | Next.js App Router + React + TypeScript (.md §1.1) |
| UI kit | **shadcn/ui on Tailwind CSS v4.** Components are copied into `frontend/components/ui/` and pre-themed. Teammates import them; they never restyle them. (.md §14: extra components allowed when justified) |
| Brand | **Yallaway** (wordmark, header, footer, auth pages, SEO titles) |
| Theme | **Dark mode only**, soft muted purple + cyan, modern and clean |
| Font | **Plus Jakarta Sans** for everything, self-hosted with `next/font/google` (no external font request at runtime, so a cloud deploy works) |
| Icons | **Outline icons from Lucide** (`lucide-react`, the shadcn default, 2px stroke) (one icon family; shadcn already uses it) |
| Corners | 8px inputs and buttons, 12px cards, full-round only for avatars and status pills |
| Imagery | Real photos for hotels and destinations; So3ad flat illustrations for empty, error, loading and success states |
| Motion | Subtle; everything respects `prefers-reduced-motion` |
| Traveler nav | Top navbar only (hamburger drawer on mobile) |
| Moderator / admin nav | Left sidebar layout |
| Itinerary day reorder | Drag handle **and** up/down buttons (WCAG 2.2 dragging alternative) |
| Booking wizard | One page with a stepper; the booking id is in the URL so a refresh resumes the right step |
| Charts | Bars everywhere (+ one line for revenue over time), always with a table alternative |
| Terms page | Placeholder text written by us, clearly marked |
| Responsive | Every page reflows; detailed mobile designs for public pages, search, booking, payment, My Bookings, itinerary editor. Dashboards reflow sensibly |
| Deployment | Keep it deployable (decision ~5 Dec): no local-only assets |
| Mascot | **So3ad**, look A "The Navigator" (§9) |

---

## 2. Color tokens (dark only, contrast checked)

All ratios were measured against the three surfaces (background / card / raised). Every text pair passes WCAG AA (≥ 4.5:1). Input borders pass the 3:1 non-text rule.

| Token (CSS variable) | Hex | Use | Contrast |
|---|---|---|---|
| `--background` | `#0E0E16` | Page background | n/a |
| `--card` / `--popover` | `#16161F` | Cards, dropdowns, dialogs | n/a |
| `--muted` (raised) | `#1E1E2A` | Raised panels, table header, hover row | n/a |
| `--foreground` | `#E8E7EF` | Body text | 13.4–15.7:1 |
| `--muted-foreground` | `#A5A3B6` | Secondary text, labels | 6.7–7.8:1 |
| `--subtle-foreground` | `#8D8BA0` | Hints, captions, timestamps | 5.0–5.8:1 |
| `--primary` | `#6E56B8` | Primary button fill | white label 5.7:1 |
| `--primary-hover` | `#5F4AA3` | Primary button hover/pressed | white label 7.0:1 |
| `--primary-foreground` | `#FFFFFF` | Text on primary | n/a |
| `--link` | `#B3A4DE` | Links, active nav item, selected tab | 7.3–8.5:1 |
| `--accent-cyan` (`--ring`) | `#6CC4D2` | Focus ring, highlights, prices, selected chips | 8.2–9.6:1 |
| `--success` | `#6CC9A1` | Confirmed, Refunded, Available, Active | 8.2–9.6:1 |
| `--warning` | `#E3B866` | Pending Payment, Pending refund, hold timer < 2 min | 8.9–10.4:1 |
| `--error` | `#E68A8A` | Field errors, Failed, Expired | 6.6–7.7:1 |
| `--info` | `#86AEE0` | Info toasts, Completed, Scheduled | 7.2–8.4:1 |
| `--destructive` | `#C24848` | Destructive button fill (cancel booking, delete) | white label 4.9:1 |
| `--input` | `#706E88` | Input, select and checkbox outlines | 3.4–3.9:1 |
| `--border` | `#34344A` | Decorative dividers and card outlines only | decorative |

Status colors are **never the only signal**: every pill also has an icon and a word (GEN-17, WCAG color-not-only).

Chart palette (bars): `#8F7AD6`, `#6CC4D2`, `#E3B866`, `#6CC9A1`, `#E68A8A`, each series also gets a label in the table alternative.

---

## 3. Typography, spacing, radius, elevation, motion

**Type scale** (Plus Jakarta Sans; tabular figures for prices, times and countdowns)

| Role | Size / line height | Weight | Tailwind |
|---|---|---|---|
| Display (home hero only) | 48 / 56 (36 / 44 mobile) | 700 | `text-display` |
| H1 page title | 32 / 40 (28 / 36 mobile) | 700 | `text-h1` |
| H2 section | 24 / 32 | 600 | `text-h2` |
| H3 card title | 18 / 28 | 600 | `text-h3` |
| Body | 16 / 24 | 400 | `text-base` |
| Small / label | 14 / 20 | 500 | `text-sm` |
| Caption | 12 / 16 (never for body text) | 500 | `text-xs` |

**Spacing:** 4px base, use 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. Section gap 48 desktop / 32 mobile. Page side gutter 16 mobile, 24 tablet, 32 desktop. Content max width 1200px (`max-w-6xl`); long text max 70 characters.

**Radius:** `--radius: 0.75rem` (12px, cards). shadcn derives `rounded-md` ≈ 10px and `rounded-sm` ≈ 7px; buttons and inputs use `rounded-lg` set to 8px in our overrides.

**Elevation:** flat surfaces separated by color, not shadows. Only popovers, dropdowns, dialogs and toasts get one shadow: `0 8px 24px rgb(0 0 0 / 0.45)`.

**Z-index scale:** content 0 · sticky header 20 · dropdown 30 · drawer 40 · dialog 50 · toast 60.

**Motion tokens:** `--duration-fast: 150ms` (hover, press, toggles), `--duration-base: 250ms` (dialogs, drawers, tabs), exits ~70% of enters, ease-out on enter, ease-in on exit. Only opacity and transform are animated. Under `prefers-reduced-motion: reduce`: transitions become instant and So3ad shows a still pose.

**Breakpoints:** Tailwind defaults, `sm 640 · md 768 · lg 1024 · xl 1280`. Design checks at 375, 768, 1024, 1440.

---

## 4. `globals.css` theme (the only place colors are defined)

Follows the shadcn/ui Tailwind v4 theming setup (CSS variables under `:root`, exposed to Tailwind with `@theme inline`). Dark only, so the dark values live directly in `:root` and there is no `.dark` block.

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-hover: var(--primary-hover);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--muted);
  --color-secondary-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-subtle-foreground: var(--subtle-foreground);
  --color-accent: var(--muted);
  --color-accent-foreground: var(--foreground);
  --color-link: var(--link);
  --color-cyan: var(--accent-cyan);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-error: var(--error);
  --color-info: var(--info);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --font-sans: var(--font-jakarta);
}

:root {
  color-scheme: dark;
  --radius: 0.75rem;
  --background: #0E0E16;
  --card: #16161F;
  --popover: #16161F;
  --muted: #1E1E2A;
  --foreground: #E8E7EF;
  --muted-foreground: #A5A3B6;
  --subtle-foreground: #8D8BA0;
  --primary: #6E56B8;
  --primary-hover: #5F4AA3;
  --primary-foreground: #FFFFFF;
  --link: #B3A4DE;
  --accent-cyan: #6CC4D2;
  --ring: #6CC4D2;
  --success: #6CC9A1;
  --warning: #E3B866;
  --error: #E68A8A;
  --info: #86AEE0;
  --destructive: #C24848;
  --input: #706E88;
  --border: #34344A;
}

@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground font-sans antialiased; }
  :focus-visible { @apply outline-2 outline-offset-2 outline-ring; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
}
```

When the kit is built, this snippet is checked again against the installed shadcn and Tailwind versions.

---

## 5. Rules for teammates (read this once)

1. **Use a layout.** Every page is wrapped in `PublicShell`, `AppShell` or `DashboardShell` (§7). Never build your own header, footer or sidebar.
2. **Use the kit.** Buttons, inputs, cards, tables, dialogs, badges, toasts, empty states: always from `@/components/ui` or `@/components/app`. Never a raw `<button>` with classes.
3. **No colors, fonts or shadows in pages.** No hex values, no `text-purple-500`, no `style={{...}}`. A lint rule blocks raw Tailwind palette colors and inline styles outside `components/`.
4. **Allowed `className` in pages:** layout only (`grid`, `flex`, `gap-*`, `col-span-*`, `mt-*`, `hidden md:block`). Everything visual comes from props (`variant`, `size`, `tone`).
5. **Money:** always `<Price cents={...} currency={...} />`. Never format cents by hand (PAY-04).
6. **Flight times:** always `<LocalTime iso={...} timeZone={airport.timeZone} airport="CAI" />` (GEN-06).
7. **Statuses:** always `<StatusBadge status="pending_payment" />`. The label, icon and color come with it (GEN-11).
8. **Lists:** every list over 10 items uses `<Pagination>` (GEN-05) and has an `<EmptyState>` (GEN-04).
9. **Forms:** every input goes through `<FormField>` so the label and the inline error from the backend's `fieldErrors` appear under the field (GEN-02).
10. **Destructive actions:** always `<ConfirmDialog>` (GEN-03).
11. **Every page designs 4 states:** loading (skeleton or So3ad), empty, error with Retry, success (toast).
12. **Keep the requirement id** in a comment at the top of each page file (e.g. `// P-12 Flight search: FLT-11, FLT-12, FLT-15, GEN-06`).
13. Frontend checks only mirror the backend; the backend stays the real protection (.md §7.2, §14, GEN-13).

---

## 6. Component inventory (what exists, how to call it)

Folder plan: `frontend/components/ui/` = shadcn base components, already themed. `frontend/components/app/` = Yallaway components built on top. `frontend/components/layout/` = shells.

### 6.1 Base (`components/ui`, from shadcn, pre-themed)

| Component | Variants / props | Notes |
|---|---|---|
| `Button` | `variant`: `primary` (default), `secondary`, `ghost`, `destructive`, `link`; `size`: `sm`, `md` (default, 44px high), `lg`, `icon`; `loading` | `loading` shows a spinner, disables the button and keeps its width. `icon` size requires `aria-label` |
| `Input`, `Textarea` | `maxLength` shows a counter (500 comments, 1000 reviews) | 44px high, `--input` outline, cyan focus ring |
| `PasswordInput` | `showRules` | Show/hide toggle + live rule checklist (8+ chars, 1 letter, 1 digit; ACC-01) |
| `Select`, `Combobox` | `options`, `searchable` | Combobox for airports, cities, countries, currencies |
| `MultiSelect` | `max` | Chips; countries, tags (max 5, 30 chars) |
| `Checkbox`, `RadioGroup`, `Switch`, `SegmentedControl` | standard | Segmented: one-way/round-trip, Draft/Publish, Public/Private |
| `DatePicker`, `DateRangePicker`, `TimePicker` | `min`, `max` | Check-in can't be in the past |
| `DateTimePicker` | `timeZone` | Shows the airport zone label (FLT-03) |
| `NumberStepper` | `min`, `max`, `label` | Passengers, guests, rooms, bags |
| `Card` | `interactive` | `interactive` adds hover + pointer for clickable cards |
| `Dialog`, `Sheet`, `DropdownMenu`, `Popover`, `Tooltip` | standard | Escape and close button always present |
| `Tabs` | standard | Upcoming / Past / Cancelled |
| `Table` | standard | Base for `DataTable` |
| `Skeleton`, `Spinner` | standard | Skeleton for loads over ~300ms |
| `Toast` (Sonner) | `success`, `error`, `info` | Auto-dismiss 4s, `aria-live="polite"`, never steals focus |
| `Avatar`, `Separator`, `Badge` | standard | |

### 6.2 Yallaway components (`components/app`)

| Component | Props | Requirement |
|---|---|---|
| `FormField` | `label`, `name`, `error`, `hint`, `required` | GEN-02 (maps backend `fieldErrors[]` to fields) |
| `FormErrorSummary` | `errors` | Focused after a failed submit with several errors |
| `StatusBadge` | `status` | GEN-11, PAY-03, FLT-30, HTL-08, ACC-15, BLG-03, GEN-10 (table §6.3) |
| `Price` | `cents`, `currency`, `size` | PAY-04 (12000 → "$120.00 USD", tabular figures) |
| `BudgetAmount` | `amount` (decimal), `currency` | ITN-14, ITN-18 |
| `LocalTime` | `iso`, `timeZone`, `airport`, `showDate` | GEN-06, FLT-17 |
| `EmptyState` | `pose`, `title`, `action` | GEN-04 (So3ad pose + line + one action) |
| `ErrorState` | `onRetry`, `message` | GEN-16 |
| `ConfirmDialog` | `title`, `consequence`, `confirmLabel`, `tone="destructive"` | GEN-03 |
| `Pagination` | `page`, `totalPages` | GEN-05 (page size 10, matches backend `{items,page,pageSize,total,totalPages}`) |
| `DataTable` | `columns`, `data`, `sortable`, `filters`, `rowActions` | ACC-14, ACC-17, GEN-07, FLT-29, HTL-22 |
| `HoldCountdown` | `expiresAt` | FLT-22, HTL-18 (warning tone + So3ad line under 2 min; `aria-live` only at 5, 2, 1 min and 0) |
| `Stepper` | `steps`, `current` | P-14, P-19 |
| `ImageUploader` | `max`, `existing`, `onAdd`, `onRemove` | GEN-08 (JPG/PNG, ≤ 5 MB, ≤ 5; 1 for airline logo) |
| `TiersEditor` | `value`, `onChange` | FLT-09, HTL-10 |
| `RefundPreview` | `cancellation` | FLT-26, HTL-21 (uses the backend `cancellation` field) |
| `PolicyAcceptance` | `policies`, `onAccept` | PAY-02 (Pay stays disabled until accepted) |
| `StripePaymentPanel` | `clientSecret`, `amountCents` | PAY-01 (Stripe Elements, card data never touches our code) |
| `PassengerCard` | `index`, `value`, `bagPolicy` | FLT-19, FLT-21, FLT-08 |
| `GuestsPerRoom` | `rooms` | HTL-16 |
| `FlightSearchForm`, `HotelSearchForm` | `defaultValues` | FLT-11/12/15, HTL-11/12 |
| `FilterPanel`, `SortSelect` | `fields` | min > max error inline (FLT-15, HTL-12) |
| `FlightResultCard`, `HotelResultCard` | data | FLT-11, HTL-11 |
| `RoundTripSelector` | `outbound`, `return` | FLT-12 |
| `DayCard`, `CityGroupHeader`, `ActivityCard`, `BudgetRow`, `TransportRow` | data + handlers | ITN-05…ITN-16 |
| `BudgetSummary` | `summary` | ITN-14, ITN-18 (rate date + stale-rates notice) |
| `PostCard`, `CommentItem`, `LikeButton`, `ReviewCard` | data | BLG-02/05/06/07, HTL-24; "Deleted user" (ACC-12) |
| `ReportButton` (+ modal) | `contentType`, `contentId` | GEN-09 |
| `HiddenBadge` | none | GEN-10 |
| `NotificationBell` | none (fetches itself) | GEN-01 |
| `StatCard` | `label`, `value`, `icon`, `href` | role home pages |
| `AvailabilityGrid` | `rooms`, `days` | HTL-08 |
| `SeatMap` (Bonus) | `cabin`, `taken`, `selected` | FLT-28 |
| `BarChart` (+ table) | `series`, `labels` | ITN-14, BON-01 |
| `So3ad` | `pose`, `size`, `line` | §9 |

### 6.3 `StatusBadge` mapping

| Status | Label | Tone | Icon (Lucide) |
|---|---|---|---|
| `pending_payment` | Pending payment | warning | `Clock` |
| `confirmed` | Confirmed | success | `CircleCheck` |
| `completed` | Completed | info | `Flag` |
| `expired` | Expired | error | `TimerOff` |
| `cancelled` | Cancelled | neutral | `CircleX` |
| `scheduled` / `departed` / flight `cancelled` | Scheduled / Departed / Cancelled | info / neutral / error | `PlaneTakeoff` / `PlaneLanding` / `Ban` |
| `available` / `booked` / `blocked` | Available / Booked · ref / Blocked | success / info / neutral | `Check` / `BedDouble` / `Lock` |
| refund `pending` / `refunded` / `failed` | Refund pending / Refunded / Refund failed | warning / success / error | `Hourglass` / `BadgeDollarSign` / `TriangleAlert` |
| `active` / `suspended` | Active / Suspended | success / error | `UserCheck` / `UserX` |
| `draft` / `published` | Draft / Published | neutral / info | `PencilLine` / `Globe` |
| `hidden` | Hidden | warning | `EyeOff` |

Badge fills are the tone at 15% opacity over the card with the tone color as text. Checked: success 6.8:1, warning 7.2:1, error 5.6:1, info 6.0:1, neutral 5.7:1 (neutral uses `--muted-foreground`).

---

## 7. Layouts (shells)

| Shell | Who | Contents |
|---|---|---|
| `PublicShell` | Guest pages, public content | Sticky top header: Yallaway wordmark, Flights, Hotels, Itineraries, Blog, Log in (ghost), Sign up (primary). Mobile: hamburger → left `Sheet`. Footer: links, `/terms`. Skip-to-content link |
| `AppShell` | Registered User | Same header pattern; nav: Flights, Hotels, My Bookings, My Itineraries, Explore Itineraries, Blog, My Posts; right side: `NotificationBell` + profile menu (Profile, Change password, Log out separated at the bottom) |
| `DashboardShell` | Airline Moderator, Hotel Moderator, Admin | Left sidebar (collapses to a `Sheet` under `lg`) with the role's nav from the spec §2, top bar with page title, bell and profile menu. Content area `max-w-7xl` |
| `AuthLayout` | P-01…P-04, P-08…P-10 | Centered card (max 440px) with the wordmark and a small So3ad on the side on desktop |
| `WizardLayout` | P-14, P-19 | Inside `AppShell`: `Stepper` on top, `HoldCountdown` sticky on the right (bottom bar on mobile), summary card in a side column |

Active nav item: `--link` text + 2px cyan underline (top nav) or a raised background + left bar (sidebar). Every route change moves focus to `<main>`.

---

## 8. Patterns

- **Search pages (P-12, P-15):** form on top (collapses to a summary chip row after the search on mobile), filters in a left column on desktop and a `Sheet` on mobile, results list with skeleton cards while loading, So3ad binoculars on first load over 1s.
- **Booking wizard:** Back never loses entered data; when the hold expires, a blocking dialog with So3ad "Time's up!" and a "Search again" action (the booking is Expired).
- **Payment:** after submit, the panel shows "Waiting for confirmation" and polls `GET /api/payments/:id` until the webhook confirms; failures show the reason + Retry until the hold expires.
- **Detail pages:** breadcrumb on desktop, a back link on mobile (GEN-14).
- **Dashboards:** stat cards row → main table → recent activity. Tables collapse to stacked cards under `md`.
- **Guest restricted actions (ACC-10):** the button stays visible; clicking it opens login and returns to the same action afterwards.
- **Session expired (ACC-06):** a toast + redirect to login with a `returnTo` back to the current page.

---

## 9. Mascot: So3ad (look A, "The Navigator")

- Egyptian woman in her 20s, no hijab, original character (must not resemble an existing character or brand).
- **Hair:** shoulder-length dark-brown curls in a half-up puff. **Skin:** warm medium brown.
- **Outfit:** muted purple bomber jacket (`#6E56B8` family) over a white tee, dark jeans, cyan sneakers (`#6CC4D2`), small crossbody bag.
- **Signature item:** round cyan sunglasses pushed up on her head. She pulls them down for the sassy smirk.
- **Style:** flat 2D vector, no outlines heavier than 2px, 2–3 shades per color, transparent background, exported as SVG; simple loops as CSS/SVG or Lottie.
- **Voice:** spelled "So3ad"; English lines with an occasional yalla / mabrouk / habibi; funny and sassy, never mean.
- **Character sheet to deliver:** front, side, 3/4; expressions happy, sassy smirk, surprised, sad, thinking; color swatches.

| Pose | Where | Line | Animation |
|---|---|---|---|
| Waving with suitcase | Home hero | "Yalla! Where are we going?" | wave loop 2.4s, ease-in-out |
| Binoculars / rolling suitcase | Search loading | "Hold on, I'm haggling for you…" | loop 1.6s |
| Tapping card | Payment processing | "Don't blink, the bank is thinking." | loop 1.2s |
| Jumping + confetti | Booking confirmed | "Mabrouk! Your trip is booked." | once 1.2s |
| Shrug, empty map | Empty search | "Nothing here… try other dates?" | still + blink |
| Sitting on suitcase | Empty lists | "So empty! Let's plan something." | still + blink |
| Upside-down map | 404 / error | "Even I got lost. Let's go home." | once 0.8s |
| Looking at watch | Hold expiring / expired | "Time's up! The seats ran away." | once 0.8s |
| Holding a key | Login needed / session expired | "Log in first, habibi." | still |
| Worried, hands up | Confirm dialogs | "Are you sure? No take-backs!" | still |
| Head avatar pointing | Tips / tooltips | short tips | still |

Under reduced motion every pose shows its final still frame. The decorative So3ad image gets `alt=""`; her line is real text next to it.

---

## 10. Accessibility checklist (every page)

- Text ≥ 4.5:1, input outlines and focus ring ≥ 3:1 (already true for the tokens).
- Visible cyan focus ring on everything focusable; never removed.
- Tab order = visual order; skip link in every shell; one `h1` per page, no skipped heading levels.
- Icon-only buttons have `aria-label`; decorative icons have `aria-hidden`.
- Inputs have visible labels (never placeholder-only), `autocomplete` on auth fields, paste allowed in passwords.
- Errors under the field, linked with `aria-describedby`; multi-error forms focus `FormErrorSummary`.
- Targets at least 44px high for primary controls, 24px minimum for anything else.
- Day reorder has up/down buttons besides drag (ITN-08).
- Charts have a data table alternative.

---

## 11. Rendering (.md §9, justify at evaluation)

| Page | Strategy |
|---|---|
| Published blog post (P-30), author page (P-32), public itinerary (P-28) | ISR / Static + SEO metadata |
| Blog listing/search (P-29), public itinerary search (P-27), flight/hotel search (P-12, P-15), bookings (P-20…P-23), private itinerary (P-26), dashboards | Dynamic SSR |
| Blog editor/drafts (P-33, P-34), itinerary editor (P-26) | Dynamic SSR + Client Components |
| Likes and comments | Client Components |

Kit components are Client Components only where they need interactivity (dialogs, pickers, uploader, countdown); display components (`Price`, `StatusBadge`, `LocalTime`, `Card`) work in Server Components.

---

## 12. Still open

- Confirm the items above (Lucide, type scale, radius detail, motion timings, chart colors, So3ad loop timings).
- Recheck the `globals.css` snippet when the kit is built against the installed shadcn and Tailwind versions.
- So3ad artwork: who draws it, or which tool generates it (any AI use must be logged in `AI_PROMPTS.txt`, .md §11).
