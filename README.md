# Travel Planning & Booking Platform

Software Project I, Winter 2026, German International University.

A web platform for flight and hotel booking, itinerary planning and budgeting, and travel blogging.
The website is called **Yallaway**.

**For evaluators:** start with [Quick Start](#quick-start), log in with the [demo accounts](#demo-accounts),
and use [Swagger](#using-swagger) for the API. Why each page renders the way it does:
[docs/RENDERING.md](docs/RENDERING.md).

| Part | Technology | Folder |
|---|---|---|
| Model + Controller | NestJS, MongoDB Atlas (Mongoose) | [backend/](backend/) |
| View | Next.js 16 (App Router), React 19, Tailwind CSS, shadcn/ui | [frontend/](frontend/) |
| Payments | Stripe (test mode) | |
| Exchange rates | FXRatesAPI | |

## Team

| Name | Student ID | Tutorial |
|---|---|---|
| Khaled Ahmed (team leader) | 16002932 | P26 |
| Mostafa Amr Elsallamy | 16008276 | P3 |
| Omar Ahmed Alaga | 16001929 | P15 |
| Hussien Shata | 16005103 | P26 |
| Abdallah Mahmoud | 16005009 | P27 |
| Ibrahim El Shafey | 16005172 | P02 |
| Ibrahim Samer Alalamy | 16005828 | P08 |
| Salaheldin Mahmoud Abo Hussein | 16004541 | P18 |

## Milestones

| Milestone | Scope | Deadline |
|---|---|---|
| 1 | Backend & API, evaluated through Swagger UI | 20/11 |
| 2 | Frontend & integration | 11/12 |

## Quick Start

Prerequisites: Node.js 20+, npm, and the [Stripe CLI](https://docs.stripe.com/stripe-cli) for payments.
Use Chrome or Edge locally: Safari refuses `Secure` cookies on `http://localhost`.

**1. Backend** (terminal 1):

```bash
cd backend
npm install
cp ../.env.example .env      # then fill in the values (see below)
npm run seed                 # official reference data + the admin account
npm run seed:demo            # demo accounts, flights and hotels (optional, needs DEMO_PASSWORD)
npm run start:dev
```

**2. Stripe webhook** (terminal 2): see [Stripe Webhooks](#stripe-webhooks-local).

**3. Frontend** (terminal 3):

```bash
cd frontend
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run dev                  # or: npm run build && npm start
```

| Address | What |
|---|---|
| http://localhost:3001 | The website. Always open it here, not on :3000: the frontend forwards `/api` and `/uploads` to the backend, so the browser sees one site and the login cookies work |
| http://localhost:3000/api/docs | Swagger UI |
| http://localhost:3000/api/health | Health check |
| http://localhost:3001/kit | The design-system component gallery (for developers; hidden from search engines) |

## Demo Accounts

`npm run seed` creates the admin; `npm run seed:demo` creates the rest. Every demo account uses the
password in `DEMO_PASSWORD`; the admin uses `ADMIN_PASSWORD` (both in `backend/.env`, from the team leader).

| Role | Email | Home page after login |
|---|---|---|
| Admin (ACC-18) | `ADMIN_EMAIL` in `backend/.env` | `/admin` |
| Registered user | `demo.user@yallaway.local` | `/home` |
| Airline moderator (Demo Air, 6 flights CAI / DXB / LHR in the next 30 days) | `demo.airline@yallaway.local` | `/airline` |
| Hotel moderator (one Demo Hotel per seeded city, 3 rooms each) | `demo.hotel.<cityId>@yallaway.local`, e.g. `demo.hotel.cairo@yallaway.local` | `/hotel` |

A guest can search flights and hotels, explore public itineraries and read the blog without logging in.
To pay on the website, use the Stripe test card `4242 4242 4242 4242`, any future date and any CVC.

## Backend

### Environment Variables (`backend/.env`)

All names are listed in [.env.example](.env.example). Never commit `backend/.env`.

| Variable | Needed | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | Shared MongoDB Atlas connection string (from the team leader) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | yes | Long random strings for the session cookies (ACC-04, ACC-19) |
| `STRIPE_SECRET_KEY` | yes | Stripe **test mode** secret key (`sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | for payments | The `whsec_...` value printed by `stripe listen` (each developer has their own) |
| `PLATFORM_CURRENCY` | yes | The single currency of all prices, payments and refunds (`USD`, PAY-04) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | for the seed | The seeded admin account (ACC-18) |
| `FXRATES_API_KEY` | no | FXRatesAPI key; the free endpoint also works without one (ITN-18) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | no (bonus) | Email (GEN-01-B, ACC-02, ACC-07). Use a test inbox such as [Ethereal](https://ethereal.email). When empty, no email is sent and, outside production, the verification and reset links are written to the server log |
| `PORT`, `FRONTEND_URL` | no | API port (default `3000`) and the website address used for cookies and email links (default `http://localhost:3001`) |
| `REVALIDATE_SECRET` | no | Lets the backend refresh cached pages at once after a change (same value as in `frontend/.env.local`). Empty: they refresh every minute |
| `DEMO_PASSWORD` | for `seed:demo` | Password of every demo account |
| `REQUIRE_EMAIL_VERIFICATION` | no (bonus) | `true`: a new account cannot book until it opens the emailed verification link (ACC-02). Empty or `false`: new accounts can book at once |

The server stops at start-up with a clear message if a required variable is missing.

### Stripe Webhooks (Local)

Payments are confirmed only by the Stripe webhook (PAY-01), so keep this running while testing payments:

```bash
stripe login
stripe listen --events payment_intent.succeeded,payment_intent.payment_failed,payment_intent.canceled,refund.created,refund.updated,refund.failed --forward-to localhost:3000/api/payments/webhook
```

Copy the printed `whsec_...` value into `STRIPE_WEBHOOK_SECRET` and restart the backend.

### Using Swagger

Open http://localhost:3000/api/docs. Every endpoint is documented in [docs/api/openapi.yaml](docs/api/openapi.yaml) with request examples and every error response. Authentication uses httpOnly cookies (ACC-19): after `POST /api/auth/login` the browser sends the cookies automatically, and `POST /api/auth/logout` ends the session.

- **After 15 minutes:** the access cookie lasts 15 minutes. If an endpoint answers `401`, call `POST /api/auth/refresh` (no body) and execute the request again. The session ends only after 30 minutes without activity (ACC-06).
- **Edit forms (`PATCH /api/airlines/{id}`, `PATCH /api/hotels/{id}`):** start empty; fill only the fields to change. An empty field means "not changed".

- **Admin:** log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` (created by `npm run seed`).
- **Moderators:** the admin creates an airline (`POST /api/airlines`) or a hotel (`POST /api/hotels`), then a moderator for it with a temporary password (`POST /api/admin/moderators`). The moderator logs in and must first set a new password (`PATCH /api/auth/change-password`).
- **Registered user:** `POST /api/auth/register`, then log in.
- **Payments in Swagger:** send `paymentMethodId: "pm_card_visa"` (succeeds) or `"pm_card_chargeDeclined"` (fails) in `POST /api/payments`. No card data reaches the backend.

### Demo: Booking a Flight in Swagger

1. Airline moderator: `POST /api/flights` (airports from the seed, e.g. `CAI` → `DXB`), `POST /api/flights/{id}/cabins`, `PUT /api/airlines/{id}/baggage-policy`, `PUT /api/airlines/{id}/cancellation-policy`.
2. User: `GET /api/flights/search`, `GET /api/flights/{id}`, `POST /api/flight-bookings` (summary), `POST /api/flight-bookings/hold` (seats held for 10 minutes).
3. `GET /api/bookings/flight/{id}/policies`, `POST /api/bookings/flight/{id}/accept-policies`, `POST /api/payments` with `pm_card_visa`.
4. The webhook confirms the booking: `GET /api/flight-bookings/{id}` shows the reference and payment status; `GET /api/flight-bookings/{id}/e-ticket` downloads the PDF.
5. `POST /api/flight-bookings/{id}/cancel` refunds by the airline's tiers; `GET /api/refunds/{id}` shows the refund status.

Hotels follow the same steps: the moderator adds rooms (`POST /api/hotels/{id}/rooms`), their bookable dates (`POST /api/hotels/{id}/rooms/{roomId}/availability`) and policies (`PUT /api/hotels/{id}/policies`); the user searches (`GET /api/hotels/search`), books (`POST /api/hotel-bookings`), accepts the policies and pays.

### Scripts

| Command | What it does |
|---|---|
| `npm run start:dev` | Runs the API with hot reload |
| `npm run seed` | Loads the official reference data and the admin account (safe to run again) |
| `npm run seed:demo` | Creates the demo accounts, flights and hotels through the API (safe to run again) |
| `npm run build` | Compiles to `dist/` |
| `npm run lint` | Lints and fixes `src/` |
| `npm test` | Runs the unit tests |
| `npm run test:system` | Runs the system tests against the real app, Atlas and Stripe test mode; it creates and drops its own throwaway database |

## Frontend

The team's guide to the frontend (kit, rules, sessions, tests) is [frontend/README.md](frontend/README.md).

### Environment Variables (`frontend/.env.local`)

All names are listed in [frontend/.env.example](frontend/.env.example). Never commit `.env.local`.
It is read both when building and when running.

| Variable | Needed | Purpose |
|---|---|---|
| `BACKEND_URL` | yes | Where the backend runs (`http://localhost:3000`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | for payments | Stripe **test mode** publishable key (`pk_test_...`, same Stripe account as the backend). Without it the card form stays empty |
| `REVALIDATE_SECRET` | no | Same value as in `backend/.env` (on-demand refresh of cached pages) |
| `NEXT_PUBLIC_SITE_URL` | no | Public address of the site for SEO links, `robots.txt` and `sitemap.xml` (default `http://localhost:3001`) |

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 3001 |
| `npm run build`, `npm start` | Production build, then serve it on port 3001 |
| `npm run lint`, `npm run typecheck` | ESLint and TypeScript checks |
| `npm test` | Component tests (Vitest + React Testing Library) |
| `npm run test:e2e` | Whole pages in a real browser (Playwright), desktop and phone, against the running backend with the demo data. Includes `e2e/responsive.spec.ts`: every page at 375, 768, 1024 and 1440 px must not scroll sideways (GEN-16) |

### Rendering and SEO

Each page uses the rendering strategy that fits it (project description section 9): ISR for the public
itinerary, blog post and author pages, dynamic server rendering for search and per-user pages, and Client
Components only where the user interacts. The full table, the reasons and the build check are in
[docs/RENDERING.md](docs/RENDERING.md). Public pages have a title, description, canonical URL and Open Graph
data; private pages are `noindex`; `/robots.txt` and `/sitemap.xml` are generated.

## Reference Data

`npm run seed` loads the official datasets (PDF section 5.1) from [backend/src/database/seed-data/](backend/src/database/seed-data/): countries, cities, airports (with their IANA time zones) and attractions, keeping the official ids (`EG`, `cairo`, `CAI`, `att-1`). The supported currencies are the currency codes in the countries file. The same records are used at evaluation, so do not change them.

## Documentation

| Document | Contents |
|---|---|
| [docs/requirements/](docs/requirements/) | Official requirements workbook, mock data and the GitHub issue list |
| [docs/milestone1/](docs/milestone1/) | Project description and task sheets per work area (with the dependencies between areas) |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Git workflow, code structure and API conventions |
| [docs/api/openapi.yaml](docs/api/openapi.yaml) | Swagger documentation of every endpoint (shown at `/api/docs`) |
| [docs/RENDERING.md](docs/RENDERING.md) | Rendering strategy of every page and why (project description section 9) |
| [design-system/yallaway/MASTER.md](design-system/yallaway/MASTER.md) | Design system: colors, type, components, accessibility and responsive rules |
| [frontend/README.md](frontend/README.md) | Frontend guide for the team: the component kit, rules, sessions, tests |
| [AI_PROMPTS.txt](AI_PROMPTS.txt) | AI usage log (mandatory) |
