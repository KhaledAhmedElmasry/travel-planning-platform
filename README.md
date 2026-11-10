# Travel Planning & Booking Platform

Software Project I, Winter 2026, German International University.

A web platform for flight and hotel booking, itinerary planning and budgeting, and travel blogging.

| Part | Technology | Folder |
|---|---|---|
| Model + Controller | NestJS, MongoDB Atlas (Mongoose) | [backend/](backend/) |
| View | Next.js (Milestone 2) | [frontend/](frontend/) |
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

## Getting Started (Backend)

Prerequisites: Node.js 20+, npm, and the [Stripe CLI](https://docs.stripe.com/stripe-cli) for payments.

```bash
cd backend
npm install
cp ../.env.example .env      # then fill in the values (see below)
npm run seed                 # official reference data + the admin account
npm run start:dev
```

- API: http://localhost:3000/api
- Swagger UI: http://localhost:3000/api/docs
- Health check: http://localhost:3000/api/health

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
| `npm run build` | Compiles to `dist/` |
| `npm run lint` | Lints and fixes `src/` |
| `npm test` | Runs the unit tests |

## Reference Data

`npm run seed` loads the official datasets (PDF section 5.1) from [backend/src/database/seed-data/](backend/src/database/seed-data/): countries, cities, airports (with their IANA time zones) and attractions, keeping the official ids (`EG`, `cairo`, `CAI`, `att-1`). The supported currencies are the currency codes in the countries file. The same records are used at evaluation, so do not change them.

## Documentation

| Document | Contents |
|---|---|
| [docs/requirements/](docs/requirements/) | Official requirements workbook, mock data and the GitHub issue list |
| [docs/milestone1/](docs/milestone1/) | Project description and task sheets per work area (with the dependencies between areas) |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Git workflow, code structure and API conventions |
| [docs/api/openapi.yaml](docs/api/openapi.yaml) | Swagger documentation of every endpoint (shown at `/api/docs`) |
| [AI_PROMPTS.txt](AI_PROMPTS.txt) | AI usage log (mandatory) |
