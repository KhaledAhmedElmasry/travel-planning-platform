# Travel Planning & Booking Platform

Software Project I, Winter 2026, German International University.

A web platform for flight and hotel booking, itinerary planning and budgeting, and travel blogging.

| Part | Technology | Folder |
|---|---|---|
| Model + Controller | NestJS, MongoDB Atlas (Mongoose) | [backend/](backend/) |
| View | Next.js (Milestone 2) | [frontend/](frontend/) |
| Payments | Stripe (test mode) | |
| Exchange rates | FXRatesAPI | |

## Milestones

| Milestone | Scope | Deadline |
|---|---|---|
| 1 | Backend & API, evaluated through Swagger UI | 20/11 |
| 2 | Frontend & integration | 11/12 |

## Getting Started (Backend)

Prerequisites: Node.js 20+ and npm. For payments, also install the [Stripe CLI](https://docs.stripe.com/stripe-cli).

```bash
cd backend
npm install
cp ../.env.example .env      # then fill in the values from the team leader
npm run seed                 # reference data + admin account (once the seed is implemented)
npm run start:dev
```

- API: http://localhost:3000/api
- Swagger UI: http://localhost:3000/api/docs
- Health check: http://localhost:3000/api/health

### Using Swagger

Open http://localhost:3000/api/docs. Every endpoint appears there once it is implemented with Swagger decorators. Authentication uses httpOnly cookies (ACC-19), so after logging in through Swagger the browser sends the cookie automatically.

### Stripe Webhooks (Local)

```bash
stripe login
stripe listen --forward-to localhost:3000/api/payments/webhook
```

Copy the printed `whsec_...` value into `STRIPE_WEBHOOK_SECRET` in your `backend/.env`. Each developer has their own value.

### Scripts

| Command | What it does |
|---|---|
| `npm run start:dev` | Runs the API with hot reload |
| `npm run seed` | Runs `src/database/seed.ts` (reference data and admin account, to be implemented) |
| `npm run build` | Compiles to `dist/` |
| `npm run lint` | Lints and fixes `src/` |
| `npm test` | Runs unit tests |

## Reference Data

The official datasets ([docs/requirements/Mock Data.xlsx](docs/requirements/Mock%20Data.xlsx)) are exported as CSV files in [backend/src/database/seed-data/](backend/src/database/seed-data/) for the seed script to load. Keep the official identifiers (`EG`, `cairo`, `CAI`, `att-1`), because the same datasets are used at evaluation (PDF section 5.1).

## Documentation

| Document | Contents |
|---|---|
| [docs/requirements/](docs/requirements/) | Official requirements workbook, reference datasets, and [assumed requirements](docs/requirements/ASSUMED_REQUIREMENTS.md) |
| [docs/TEAM_PLAN.md](docs/TEAM_PLAN.md) | Module ownership, timeline and design decisions |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Git workflow, code structure and API conventions |
| [docs/api/](docs/api/) | API notes (Swagger UI is the live reference) |
| [AI_PROMPTS.txt](AI_PROMPTS.txt) | AI usage log (mandatory) |
