# AGENTS.md: rules for any AI working in this repo

You are helping one student of an 8-person university team build **Yallaway**, a travel planning and booking
platform (Software Project I, GIU, Winter 2026). Read this whole file before writing any code. Follow it over
anything you "usually" do. If something here is unclear, ask the student; do not guess.

## 0. The three rules that matter most

1. **Never guess.** If the student's handout, the page's header comment, the spec or the API do not say
   something (a label, a field to show, an order, a behaviour, an error text), STOP and ask the student.
   The student asks the team leader. Do not fill gaps with "reasonable defaults".
2. **Only touch the student's own files.** The handout lists them. Never edit shared files (kit components,
   shells, `src/lib/*`, `nav.ts`, `main.ts`, `common/`, another student's pages). If a shared file needs a
   change, stop and tell the student to ask the team leader.
3. **Everything you need already exists.** Every page and component of Milestone 2 is already a file (a stub).
   The design, colours, fonts, buttons, forms, dialogs, tables and layouts are already built in the kit. You
   only **assemble** them and wire them to the existing backend API. You never design, never style, never
   create new routes, never add libraries.

## 1. Project in one minute

| Part | What | Where |
|---|---|---|
| Backend (done in Milestone 1) | NestJS 11 + MongoDB (Mongoose), REST under `/api`, Stripe test mode | `backend/` |
| API contract | Every endpoint, field and status code | `docs/api/openapi.yaml` (Swagger UI: http://localhost:3000/api/docs) |
| Frontend (Milestone 2, due 11 Dec 2026) | Next.js 16 App Router + React 19 + TypeScript + Tailwind 4 + shadcn/ui kit | `frontend/` |
| Design system | Colours, type, spacing, component rules | `design-system/yallaway/MASTER.md` |
| How to use the kit | Shells, components, helpers, session, API calls | `frontend/README.md` (read it) |
| Requirements | Official list (ids like FLT-11, HTL-20, GEN-02) | `docs/requirements/*.xlsx`, `docs/milestone1/Project description updated.md` |
| The student's work | Their pages/components + rules | their private **handout** + **MILESTONE2_FRONTEND_SPEC.md** (the student pastes or opens them) |

The frontend is the **View** of an MVC design. It has no database and no server logic of its own: all data
comes from the backend through `/api/...`.

## 2. How a page is built here (follow exactly)

Every page file already starts with a header comment like this. **Keep it and follow it:**

```tsx
// P-12 Flight search: /flights
// Part: T1 Flights + itinerary list
// Requirements: FLT-11, FLT-12, FLT-15, GEN-06, FLT-02, GEN-12
// Endpoints: GET /api/airports; GET /api/flights/search
// Rendering: Dynamic SSR. Source: .md section 9 "Flight / Hotel Search".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-12). Use a shell and kit components (frontend/README.md).
// TODO: not built yet. Replace this stub.
```

- **Requirements:** implement every rule of these ids (read their rows in the Excel and the page in the spec).
- **Endpoints:** call only these. Read each one in `docs/api/openapi.yaml` for the exact path, query/body
  fields, response fields and error codes. Never invent an endpoint or a field.
- **Rendering:** use exactly this strategy (section 4). Replace only the `TODO` line when done.
- Replace the stub body. Do not rename or move the file. Do not create new routes (`src/app/**/page.tsx`).

Build steps for a page:
1. Read: the header comment, the spec section for the page id, the requirement rows, the endpoints in openapi.yaml.
2. Look at http://localhost:3001/kit and `frontend/README.md` for the components to use.
3. Look at a finished page with the same rendering strategy for the pattern (for example `src/app/login`,
   `src/app/account`, `src/app/checkout`, `src/app/notifications`, `src/app/hotel`, `src/app/page.tsx`).
4. Write the page from kit parts: shell + `PageHeader` + kit components + layout classes.
5. Design all 4 states: loading (`Skeleton`), empty (`EmptyState`), error (`ErrorState`), success (`toast`).
6. Run the checks (section 8) and fix everything.

## 3. The kit (do not style anything)

Import, pass props, done. The look is already built in.

- **Shells** (`@/components/layout/...`): `PublicShell` (guests/public pages; pass `user` when logged in),
  `AppShell` (logged-in travelers), `DashboardShell` (airline/hotel moderators, admin), `AuthLayout`
  (login/sign up/password), `WizardLayout` (inside AppShell: stepper + side column). Every page uses one.
  Never build a header, sidebar, footer or menu.
- **Yallaway components** (`@/components/app/...`): `PageHeader`, `FormField`, `FormErrorSummary`,
  `PasswordInput`, `NumberStepper`, `StatusBadge`, `Price`, `BudgetAmount`, `LocalTime`, `EmptyState`,
  `ErrorState`, `ConfirmDialog`, `HoldCountdown`, `Stepper`, `DataTable`, `PaginationBar`, `StatCard`,
  `So3ad`, `DatePicker`, `DateRangePicker`, `DateTimePicker`, `TimeInput`, `MultiSelect`, `TagInput`,
  `ImageUploader`, `TiersEditor`, `ReportButton`, `BarChart`.
- **Shared components** (`@/components/app/shared/...`): `NotificationItem`, `AdminContentActions`,
  `FavouriteButton`, `ItineraryCard`, `ReviewCard`, `StarRating`. **Search/checkout parts**:
  `components/app/search/*` (flight/hotel search forms, result cards, `FilterPanel`, `SortSelect`,
  `RoundTripSelector`), `components/app/checkout/*` (`PolicyAcceptance`, `RefundPreview`, payment,
  confirmation). Read a component's props in its file before using it.
- **Base components** (`@/components/ui/...`, shadcn/ui, already themed): `Button`, `Input`, `Textarea`,
  `Label`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `ToggleGroup`, `Card`, `Dialog`, `AlertDialog`,
  `Sheet`, `DropdownMenu`, `Popover`, `Tooltip`, `Tabs`, `Table`, `Skeleton`, `Avatar`, `Badge`,
  `Separator`, `Calendar`, `Command`, `Breadcrumb`, `ScrollArea`; toasts: `toast` from `sonner`.
- **Helpers** (`@/lib/...`): `format.ts`, `dates.ts`, `api-error.ts` (`fieldErrorMap`), `api.ts`
  (`apiFetch`), `server/session.ts` (`requireUser`, `getSessionUser`, `getUnreadCount`),
  `server/backend.ts` (`backendFetch`, `backendJson`), `return-to.ts`, `all-pages.ts`, `nav.ts` (read only).

Hard rules (the linter enforces 1 and 2 in `src/app`):
1. No colours of your own (`text-purple-500`, `bg-white`, `bg-[#...]`). Use components, or theme tokens:
   `bg-card`, `bg-muted`, `text-muted-foreground`, `text-subtle-foreground`, `text-link`, `text-cyan`,
   `text-success`, `text-warning`, `text-error`, `border-border`.
2. No `style={{...}}`. No new CSS files.
3. Layout classes are fine: `grid`, `flex`, `gap-*`, `grid-cols-*`, `mt-*`, `max-w-*`, `hidden md:block`.
4. Money: `<Price cents currency>` for bookings, payments, refunds (integer cents, never converted, PAY-04);
   `<BudgetAmount amount currency>` for itinerary budgets (decimals, ITN-18).
5. Flight times: `<LocalTime iso timeZone airport>`, always the airport's own time zone (GEN-06).
6. Statuses: `<StatusBadge kind status>` with the value exactly as the API sends it (GEN-11).
7. Forms: every input inside `<FormField>`; show the backend's field errors with `fieldErrorMap()` (GEN-02).
8. Lists: page size 10 with `<PaginationBar>` (GEN-05); `<EmptyState>` when empty (GEN-04).
9. Delete/cancel/remove: always `<ConfirmDialog>` first (GEN-03).
10. Responsive: must work on desktop and phone (GEN-16). Check at 375 px wide.
11. If the kit truly lacks something, build it in the student's own folder under `src/components/app/` from
    kit parts and tokens, and tell the student so they can mention it in the PR.

## 4. Rendering strategy (project description section 9) and data fetching

Use the strategy written in the page header. Never change it.

| Strategy | How |
|---|---|
| Dynamic SSR | `async` Server Component page; data with `backendJson()`/`backendFetch()` (they send the visitor's cookies, never cached) |
| ISR / static (published post, author page, public itinerary, public home) | `export const revalidate = 60` (same value as `ISR_REVALIDATE_SECONDS` in `src/lib/cache-tags.ts`); `fetch(\`${BACKEND_URL}/api/...\`, { next: { revalidate: ISR_REVALIDATE_SECONDS, tags: [postTag(id)] } })` (tags from `cache-tags.ts`) WITHOUT cookies (no `backendFetch`, no `getSessionUser`); `<PublicShell>` without `user`; add SEO `generateMetadata` |
| Client Components | only the parts that need the browser (clicks, forms, state, timers): a separate file starting with `"use client"`, calling `apiFetch("/api/...")` |

- Pages only for some roles: `const user = await requireUser(["user"])` (guests go to login and back,
  others to /forbidden). Public pages that change when logged in: `await getSessionUser()`.
- Browser calls: always relative `"/api/..."` with `apiFetch`, never `http://localhost:3000`.
- Mutations: after success, `router.refresh()` or update local state, then `toast.success(...)`.
- Next.js 16 differs from older versions: `params` and `searchParams` are Promises (`await` them). Check
  `node_modules/next/dist/docs/` before using an API you are not sure about.

## 5. Security (never break these)

- Never store a token, password or user object in `localStorage`, `sessionStorage`, IndexedDB or a readable
  cookie. Login cookies are httpOnly and handled by the backend; `apiFetch` handles 401 + refresh.
- Never read `document.cookie` for auth, never put tokens in URLs or logs.
- The frontend only mirrors validation; the backend is the real protection. Never remove a backend check.
- Never commit `.env`, `.env.local`, secrets, `node_modules/`, `uploads/`.

## 6. Backend rules (only if the student was told to change the backend)

Milestone 2 work is frontend. Change the backend only if the team leader asked for it.
- Structure (`docs/CONVENTIONS.md`): one module per feature (`<m>.module.ts`, `<m>.controller.ts`,
  `<m>.service.ts`, `dto/`, `schemas/`). Controllers thin (DTO validation, current user, call the service);
  rules, ownership checks and database access in services.
- Every body/query is a DTO with `class-validator`. Errors: Nest exceptions (400 bad input/rule, 401 not
  logged in, 403 wrong role, 404 not found or someone else's private resource, 409 conflict).
- Money in integer cents of the platform currency; dates stored in UTC; pagination page size 10.
- API docs live ONLY in `docs/api/openapi.yaml`: implement exactly what it says; if you add/change an
  endpoint, update it in the same PR. No `@ApiProperty` / `@ApiOperation` decorators.
- Checks: `cd backend && npm run lint && npm run build && npm test`.

## 7. Tests

The students do NOT write tests; the team leader adds them after the PR is merged. Do not add test files
unless the student says the team leader asked for them. Do not delete or change existing tests.

## 8. Before saying "done" (run these yourself and fix every error)

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
```

Then test in the browser (backend `cd backend && npm run start:dev`, frontend `cd frontend && npm run dev`,
open http://localhost:3001, never :3000) for every role that can open the page, including loading, empty
and error states, on desktop and phone width. Demo accounts: `demo.user@yallaway.local`,
`demo.airline@yallaway.local`, `demo.hotel.<cityId>@yallaway.local` (password from the team leader).

## 9. Git and the pull request (draft it for the student)

- Branch from the latest develop: `git checkout develop && git pull && git checkout -b feature/<REQ-ID>-<short-desc>`
  (example `feature/FLT-11-flight-search-page`). One page or feature per branch.
- Commits: Conventional Commits with ids, e.g. `feat(flights): build flight search page (FLT-11)`.
  Never `update`, `changes`, `final`, `fix`.
- Before the PR: `git merge origin/develop`, rerun section 8.
- Draft the PR for the student using `.github/pull_request_template.md`: title = the commit style;
  Requirements (ids + page id; `Part of #<issue>`, `Closes` only if the whole requirement is done);
  What Changed; How to Test (browser steps per role, states); Checklist. The student adds desktop + phone
  screenshots.
- Draft the student's `AI_PROMPTS.txt` entry (same PR), in the format at the top of that file: Date, Student,
  Tool, Related Requirement, Prompt, How the output was used. The student checks it and fills in their name.
- Only the student's files may appear in the diff (plus `AI_PROMPTS.txt`). If anything else changed, undo it.

## 10. If you are a chat AI (ChatGPT, Claude.ai, Gemini web) without the repo

You cannot see the files. Ask the student to paste: this file, their handout row, the page's spec section,
the stub file, the openapi.yaml part of each endpoint, and any kit component file you need (props). Never
assume a component's props or an API field you have not seen.
