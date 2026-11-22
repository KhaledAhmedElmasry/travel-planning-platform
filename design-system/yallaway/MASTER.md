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
| Mascot | **So3ad**, "The Techie": lilac hijab, long purple hoodie, cyan joggers, phone always in hand (§9) |

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

Chart palette (`--chart-1` to `--chart-8`, always in this order, never cycled): `#9085E9` violet, `#D95926` orange, `#199E70` aqua, `#C98500` yellow, `#D55181` magenta, `#0CA30C` green, `#3987E5` blue, `#E66767` red. Validated with the dataviz palette validator on the card surface `#16161F` (dark): lightness band, chroma floor, colorblind separation (worst adjacent 8.4), normal-vision separation (worst adjacent 19.3) and 3:1 contrast all pass. The first draft colors failed (too light, cyan read as gray, red/green collided for colorblind users) and were replaced. One series uses `--chart-1` with no legend; more than 8 series fold into "Other". Every chart has a table view, and labels and values use text colors, never the series color.

---

## 3. Typography, spacing, radius, elevation, motion

**Type scale** (Plus Jakarta Sans; tabular figures for prices, times and countdowns)

| Role | Size / line height | Weight | Tailwind |
|---|---|---|---|
| Display (home hero only) | 48 / 56 (36 / 44 mobile) | 700 | `text-5xl` |
| H1 page title | 32 / 40 (28 / 36 mobile) | 700 | `text-3xl` |
| H2 section | 24 / 32 | 600 | `text-2xl` |
| H3 card title | 18 / 28 | 600 | `text-lg` |
| Body | 16 / 24 | 400 | `text-base` |
| Small / label | 14 / 20 | 500 | `text-sm` |
| Caption | 12 / 16 (never for body text) | 500 | `text-xs` |

These are Tailwind's standard size names, set to our values in `globals.css`. Don't add custom names like `text-h1`: the class-merging helper `cn()` mistakes unknown `text-*` names for colors and drops one of the two classes.

**Spacing:** 4px base, use 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. Section gap 48 desktop / 32 mobile. Page side gutter 16 mobile, 24 tablet, 32 desktop. Content max width 1200px (`max-w-6xl`); long text max 70 characters.

**Radius:** `--radius: 0.75rem` (12px, cards). shadcn derives `rounded-md` ≈ 10px and `rounded-sm` ≈ 7px; buttons and inputs use `rounded-lg` set to 8px in our overrides.

**Elevation:** flat surfaces separated by color, not shadows. Only popovers, dropdowns, dialogs and toasts get one shadow: `0 8px 24px rgb(0 0 0 / 0.45)`.

**Z-index scale:** content 0 · sticky header 20 · dropdown 30 · drawer 40 · dialog 50 · toast 60.

**Motion tokens:** `--duration-fast: 150ms` (hover, press, toggles), `--duration-base: 250ms` (dialogs, drawers, tabs), exits ~70% of enters, ease-out on enter, ease-in on exit. Only opacity and transform are animated. Under `prefers-reduced-motion: reduce`: transitions become instant and So3ad shows a still pose.

**Breakpoints:** Tailwind defaults, `sm 640 · md 768 · lg 1024 · xl 1280`. Design checks at 375, 768, 1024, 1440.

---

## 4. `globals.css` theme (the only place colors are defined)

**The real file is [`frontend/src/app/globals.css`](../../frontend/src/app/globals.css); if this section and the file ever differ, the file wins.** The snippet below shows the idea.

Follows the shadcn/ui Tailwind v4 theming setup (CSS variables under `:root`, exposed to Tailwind with `@theme inline`). Dark only: the values live on `:root` and `<html>` always has `class="dark"` so shadcn's `dark:` styles also apply.

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

Built and checked against shadcn 4.23.0 and Tailwind CSS 4.3.3 (Next.js 16.4.6). The real file also sets the radius scale (`rounded-lg` 8px, `rounded-xl` 12px), the type-scale and motion tokens, and the So3ad wave animation.

---

## 5. Rules for teammates (read this once)

1. **Use a layout.** Every page is wrapped in `PublicShell`, `AppShell` or `DashboardShell` (§7). Never build your own header, footer or sidebar.
2. **Use the kit.** Buttons, inputs, cards, tables, dialogs, badges, toasts, empty states: always from `@/components/ui` or `@/components/app`. Never a raw `<button>` with classes.
3. **No colors, fonts or shadows in pages.** No hex values, no `text-purple-500`, no `style={{...}}`. A lint rule blocks raw Tailwind palette colors and inline styles outside `components/`.
4. **Allowed `className` in pages:** layout only (`grid`, `flex`, `gap-*`, `col-span-*`, `mt-*`, `hidden md:block`). Everything visual comes from props (`variant`, `size`, `tone`).
5. **Money:** always `<Price cents={...} currency={...} />`. Never format cents by hand (PAY-04).
6. **Flight times:** always `<LocalTime iso={...} timeZone={airport.timeZone} airport="CAI" />` (GEN-06).
7. **Statuses:** always `<StatusBadge kind="booking" status={booking.status} />` with the API value. The label, icon and color come with it (GEN-11).
8. **Lists:** every list over 10 items uses `<Pagination>` (GEN-05) and has an `<EmptyState>` (GEN-04).
9. **Forms:** every input goes through `<FormField>` so the label and the inline error from the backend's `fieldErrors` appear under the field (GEN-02).
10. **Destructive actions:** always `<ConfirmDialog>` (GEN-03).
11. **Every page designs 4 states:** loading (skeleton or So3ad), empty, error with Retry, success (toast).
12. **Keep the requirement id** in a comment at the top of each page file (e.g. `// P-12 Flight search: FLT-11, FLT-12, FLT-15, GEN-06`).
13. Frontend checks only mirror the backend; the backend stays the real protection (.md §7.2, §14, GEN-13).

---

## 6. Component inventory (what exists, how to call it)

Folders: `frontend/src/components/ui/` = shadcn base components, already themed. `frontend/src/components/app/` = Yallaway components built on top. `frontend/src/components/layout/` = shells. Live gallery with code: `http://localhost:3001/kit`. Usage rules: `frontend/README.md`.

**Built** = in the kit now (branch `feature/GEN-17-ui-kit`). **Area** = each area builds it from kit parts in `src/components/app/`, following the props and rules listed here.

### 6.1 Base (`components/ui`, from shadcn, pre-themed)

| Component | Variants / props | Notes | State |
|---|---|---|---|
| `Button` | `variant`: `default` (primary), `secondary`, `outline`, `ghost`, `destructive`, `link`; `size`: `sm` (36px), `default` (44px), `lg` (52px), `icon`, `icon-sm`; `loading`; `asChild` (for links) | `loading` shows a spinner, disables the button, keeps its width and its accessible name. `icon` size requires `aria-label` | Built |
| `Input`, `Textarea`, `Label` | standard; `maxLength` on textarea (500 comments, 1000 reviews) | 44px high, `--input` outline, cyan focus ring, red outline when `aria-invalid` | Built |
| `Select`, `Command` (searchable list) | standard | `Command` for airports, cities, countries, currencies | Built |
| `Checkbox`, `RadioGroup`, `Switch`, `ToggleGroup` | standard | `ToggleGroup` = segmented: one-way/round-trip, Draft/Publish, Public/Private | Built |
| `Calendar`, `Popover` | standard | Base for date pickers | Built |
| `DatePicker`, `DateRangePicker` (nights count), `DateTimePicker` (airport local time, FLT-03), `TimeInput` | `value`, `onChange`, `min`, `max` | Values are `YYYY-MM-DD` / `YYYY-MM-DDTHH:mm` strings, exactly what the API takes | Built |
| `MultiSelect` (searchable, chips), `TagInput` (free text, max 5 × 30 chars) | `options`, `value`, `onChange`, `max` | Countries (ITN-01), tags (BLG-01, BLG-08) | Built |
| `Card`, `Dialog`, `AlertDialog`, `Sheet`, `DropdownMenu`, `Tooltip`, `Tabs`, `Table`, `Skeleton`, `Avatar`, `Badge`, `Separator`, `Breadcrumb`, `ScrollArea` | standard | Escape and close button always present on dialogs and sheets | Built |
| Toasts (`toast` from `sonner`) | `toast.success`, `toast.error`, `toast.info` | Auto-dismiss 4s, polite live region, never steals focus | Built |

### 6.2 Yallaway components (`components/app` and `components/layout`)

| Component | Props | Requirement | State |
|---|---|---|---|
| `PublicShell`, `AppShell`, `DashboardShell`, `AuthLayout`, `WizardLayout` | `user`, `unreadNotifications` | section 7, GEN-14, GEN-16 | Built |
| `PageHeader` | `title`, `description`, `actions`, `back` | GEN-14 | Built |
| `FormField` | `label`, `name`, `error`, `hint`, `required` | GEN-02 (with `fieldErrorMap()` for the backend's `fieldErrors[]`) | Built |
| `FormErrorSummary` | `errors`, `labels`, `message`, `autoFocus` | Focused after a failed submit with several errors | Built |
| `PasswordInput` | `showRules` | Show/hide + live rule checklist (8+ chars, 1 letter, 1 digit; ACC-01) | Built |
| `NumberStepper` | `label`, `hint`, `value`, `min`, `max`, `onChange` | FLT-11 passengers, HTL-11 guests/rooms, FLT-21 bags | Built |
| `StatusBadge` | `kind`, `status` (API value), `detail` | GEN-11, PAY-01, PAY-03, FLT-30, HTL-08, ACC-15, BLG-03, GEN-10 (table 6.3) | Built |
| `Price` | `cents`, `currency`, `size`, `hideCode` | PAY-04 (12000 -> "$120.00 USD", tabular figures) | Built |
| `BudgetAmount` | `amount` (decimal), `currency` | ITN-14, ITN-18 | Built |
| `LocalTime` | `iso`, `timeZone`, `airport`, `showDate`, `size`, `align` | GEN-06, FLT-17 | Built |
| `EmptyState` | `title`, `line`, `description`, `action`, `pose`, `compact` | GEN-04 | Built |
| `ErrorState` | `title`, `message`, `onRetry` | GEN-16 | Built |
| `ConfirmDialog` | `trigger`, `title`, `description`, `confirmLabel`, `cancelLabel`, `tone`, `onConfirm` | GEN-03 (stays open with a spinner while `onConfirm` runs) | Built |
| `PaginationBar` | `page`, `totalPages`, `total`, `pageSize`, `hrefFor` | GEN-05 (backend `{items,page,pageSize,total,totalPages}`; page kept in the URL) | Built |
| `DataTable` | `caption`, `columns`, `rows`, `rowKey`, `empty` | ACC-14, ACC-17, GEN-07, FLT-29, HTL-22 | Built |
| `HoldCountdown` | `expiresAt`, `onExpire` | FLT-22, HTL-18 (warning under 2 min; announced only at 5, 2, 1 min and 0) | Built |
| `Stepper` | `steps`, `current` | P-14, P-19 | Built |
| `StatCard` | `label`, `value`, `icon`, `tone`, `href` | role home pages | Built |
| `NotificationBell` | `unread` | GEN-01 (count from `/notifications/unread-count`) | Built |
| `So3ad` | `pose` (`wave`, `sit`), `size`, `label` | section 9 (more poses when the final art exists) | Built |
| `ImageUploader` | `max`, `existing`, `onAdd`, `onRemove`, `noun` | GEN-08 (JPG/PNG, up to 5 MB, up to 5; 1 for airline logo) | Built |
| `TiersEditor` + `validateTiers()` | `value`, `onChange`, `unit`, `errors` | FLT-09, HTL-10 | Built |
| `RefundPreview` | `cancellation` | FLT-26, HTL-21 (uses the backend `cancellation` field) | Area |
| `PolicyAcceptance` | `policies`, `onAccept` | PAY-02 (Pay stays disabled until accepted) | Area |
| `StripePaymentPanel` | `clientSecret`, `amountCents` | PAY-01 (Stripe Elements, card data never touches our code) | Area |
| `PassengerCard` | `index`, `value`, `bagPolicy` | FLT-19, FLT-21, FLT-08 | Area |
| `GuestsPerRoom` | `rooms` | HTL-16 | Area |
| `FlightSearchForm`, `HotelSearchForm` | `defaultValues` | FLT-11/12/15, HTL-11/12 | Area |
| `FilterPanel`, `SortSelect` | `fields` | min > max error inline (FLT-15, HTL-12) | Area |
| `FlightResultCard`, `HotelResultCard` | data | FLT-11, HTL-11 | Area |
| `RoundTripSelector` | `outbound`, `return` | FLT-12 | Area |
| `DayCard`, `CityGroupHeader`, `ActivityCard`, `BudgetRow`, `TransportRow` | data + handlers | ITN-05 to ITN-16 | Area |
| `BudgetSummary` | `summary` | ITN-14, ITN-18 (rate date + stale-rates notice) | Area |
| `PostCard`, `CommentItem`, `LikeButton`, `ReviewCard` | data | BLG-02/05/06/07, HTL-24; "Deleted user" (ACC-12) | Area |
| `ReportButton` (+ modal) | `contentType`, `contentId`, `alreadyReported`, `look` | GEN-09 (401 -> login and back, 409 -> "already reported") | Built |
| `AvailabilityGrid` | `rooms`, `days` | HTL-08 | Area |
| `SeatMap` (Bonus) | `cabin`, `taken`, `selected` | FLT-28 | Area |
| `BarChart` (+ table) | `title`, `summary`, `data`, `format`, `keepOrder` | ITN-14, BON-01 (one series, horizontal bars, hover/focus tooltip, "Show as table") | Built |

### 6.3 `StatusBadge` mapping

`<StatusBadge kind="booking" status={booking.status} />`: `kind` says which list the value is from (the same word can mean different things: a cancelled flight is an error, a cancelled booking is neutral). Values are exactly the backend's.

| `kind` | API value: label (tone) |
|---|---|
| `booking` (GEN-11) | `pending_payment` Pending payment (warning), `confirmed` Confirmed (success), `completed` Completed (info), `expired` Expired (error), `cancelled` Cancelled (neutral) |
| `payment` (PAY-01) | `pending` Payment pending (warning), `succeeded` Paid (success), `failed` Payment failed (error), `cancelled` Payment cancelled (neutral) |
| `refund` (PAY-03) | `pending` Refund pending (warning), `refunded` Refunded (success), `failed` Refund failed (error) |
| `flight` (FLT-30) | `scheduled` Scheduled (info), `departed` Departed (neutral), `cancelled` Cancelled (error) |
| `night` (HTL-08) | `available` Available (success), `booked` Booked + reference (info), `blocked` Blocked (neutral) |
| `account` (ACC-15) | `active` Active (success), `suspended` Suspended (error), `deactivated` Deactivated (neutral) |
| `provider` (ACC-15) | `active` Active (success), `inactive` Deactivated (neutral) |
| `post` (BLG-03) | `draft` Draft (neutral), `published` Published (info) |
| `content` (GEN-10) | `hidden` Hidden (warning) |

Every pill has a Lucide icon and the word; an unknown value shows as a neutral pill instead of crashing the page.

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

## 9. Mascot: So3ad ("The Techie")

- Egyptian woman in her 20s, wearing a hijab, original character (must not resemble an existing character or brand).
- **Hijab:** soft lilac (`#B3A4DE`, folds and face edge `#9886C8`), fitted close around her face with a short drape at the neck (not oversized). **Skin:** light tan / wheat (`#D9A77E`), big expressive eyes, dark-brown eyebrows (`#3B2416`).
- **Outfit (modest and sporty):** loose, hip-length purple hoodie (`#6E56B8`, hem band and front pocket `#5F4AA3`), long sleeves, white drawstrings, drawn the same in every image (same length relative to her body, same band, pocket and drawstrings); loose cyan joggers (`#4FA9B7`, cuffs `#3D8E9B`) drawn as one piece, so the legs read as part of her body; low sneakers in soft lavender-white (`#ECEAF4`) with a purple sole (`#5F4AA3`) and cyan laces, toes pointing outward. Nothing tight or cropped.
- **Same look in every image:** every pose, expression and size uses exactly this hijab, outfit and colors. Only the pose, the face and the prop in her hand change.
- **Proportions:** friendly cartoon proportions: head with hijab a bit over 1/3 of her height (slightly big, friendly head), legs a little under half; limbs have real width (no stick limbs).
- **Signature item (techy):** her phone (`#2B2D45` with a cyan screen), always in hand: she finds the deals online. She holds it up to "show" results, prices and countdowns. No headphones.
- **Style:** flat 2D vector, no outlines heavier than 2px, 2–3 shades per color, transparent background, exported as SVG; simple loops as CSS/SVG or Lottie.
- **Voice:** spelled "So3ad"; English lines with an occasional yalla / mabrouk / habibi; funny and sassy, never mean.
- **Character sheet to deliver:** front, side, 3/4; expressions happy, sassy smirk, surprised, sad, thinking; color swatches.

| Pose | Where | Line | Animation |
|---|---|---|---|
| Waving her phone, rolling suitcase | Home hero | "Yalla! Where are we going?" | wave loop 2.4s, ease-in-out |
| Scrolling fast on her phone | Search loading | "Hold on, I'm haggling for you…" | loop 1.6s |
| Tapping phone, waiting | Payment processing | "Don't blink, the bank is thinking." | loop 1.2s |
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

- So3ad artwork: who draws it, or which tool generates it (any AI use must be logged in `AI_PROMPTS.txt`, .md §11).
