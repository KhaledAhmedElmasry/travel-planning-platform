# Milestone 1 Team Plan

**Deadline:** 20/11. **Evaluation:** through Swagger UI only. Every requirement must be demonstrable without a frontend.

## Work Areas

The backend is split into eight work areas by requirement (some folders are shared between areas). Area 1 holds the hardest, most critical requirements (payments, holds, confirmation, refunds, booking automation) (14 requirements). Areas 2-8 are balanced by difficulty (19-21 points with low = 1, medium = 2, high = 3), so an area with more requirements has easier ones. The team leader assigns people to areas outside this repository; the code and docs name areas, not people. Each file's header comment starts with `// Area: ...`.

| # | Area | Folders | Requirements |
|---|---|---|---|
| 1 | Payments, Holds & Booking Engine | `payments/, flight-bookings/ (hold, confirm, cancel, e-ticket), hotel-bookings/ (booking, hold, confirm, cancel), booking cron jobs` | PAY-01, PAY-02, PAY-03, PAY-04, FLT-22, HTL-16, HTL-18, FLT-23, HTL-17, FLT-26, HTL-21, GEN-11 |
| 2 | Auth & Sessions | `auth/, users/, common/guards/, common/decorators/` | ACC-01, ACC-04, ACC-05, ACC-06, ACC-07a, ACC-08, ACC-09, ACC-11, ACC-12, ACC-19 |
| 3 | Admin, Notifications & Platform Core | `main.ts, app.module.ts, common/ (filters, pipes, pagination, enums), config/, admin/, reports/, audit/, notifications/` | GEN-02, GEN-04, GEN-05, GEN-13, ACC-18, ACC-13, ACC-14, ACC-15, ACC-16, ACC-17, GEN-07, GEN-09, GEN-10, GEN-01 |
| 4 | Blog, Reviews & Media | `blog/, reviews/, uploads/` | BLG-01, BLG-02, BLG-03, BLG-04, BLG-05, BLG-06, BLG-07, BLG-08, BLG-09, BLG-10, BLG-12, GEN-08, HTL-23, HTL-24 |
| 5 | Airlines, Flights & Reference Data | `database/ (seed), reference-data/, airlines/, flights/ (inventory), refund-tier rule in common/utils/` | GEN-12, FLT-02, FLT-01, FLT-03, FLT-04, FLT-05, FLT-06, FLT-08, FLT-09, FLT-30, GEN-06 |
| 6 | Search & My Bookings | `flights/flight-search.controller.ts, flights/ (details, manifest), flight-bookings/ (summary, lists), hotel-bookings/ (lists), hotels/ (reservations list)` | FLT-11, FLT-12, FLT-15, FLT-17, FLT-19, FLT-21, FLT-25, FLT-29, HTL-20, HTL-22, ITN-25, ITN-26 |
| 7 | Hotels & Rooms | `hotels/` | HTL-01, HTL-02, HTL-03, HTL-04, HTL-05, HTL-06, HTL-08, HTL-09, HTL-10, HTL-11, HTL-12, HTL-15 |
| 8 | Itineraries & Exchange Rates | `itineraries/, exchange-rates/` | ITN-01, ITN-03, ITN-05, ITN-07, ITN-08, ITN-09, ITN-10, ITN-12, ITN-14, ITN-16, ITN-18, ITN-20, ITN-21 |

Cross-cutting rules every area follows in its own module: GEN-02, 03, 04, 05, 11, 13.

Per-area task sheets (issues, endpoints, tasks, dependencies, workflow): [milestone1/TASKS.md](milestone1/TASKS.md) and the printable `milestone1/area-<n>-*.pdf` handouts; the usual workflow is in [milestone1/WORKFLOW.pdf](milestone1/WORKFLOW.pdf).

Frontend-only requirements (Milestone 2): ACC-10, GEN-14, GEN-15, GEN-16, GEN-17. The backend supports them by returning 401 for restricted actions and clear error messages.

## Bonus Requirements (Optional)

Start these only after every mandatory requirement is done and tested (PDF section 12: "bonus features must not replace mandatory requirements"). Placeholders are marked `BONUS (optional)` in the code.

| Bonus | Feature | Where |
|---|---|---|
| ACC-02 | Email verification | `auth/`, `mail/` |
| ACC-07 | Forgot / reset password by email | `auth/`, `mail/` |
| GEN-01-B | Email notifications over SMTP | `mail/` |
| FLT-27 | Change a confirmed flight booking | `flight-bookings/` |
| FLT-28 | Seat selection | `flight-bookings/` |
| HTL-26 | Hotel moderator reply to a review | `reviews/` |
| ITN-27 | Link confirmed bookings to itinerary days | `itineraries/` |
| ITN-28 | Export an itinerary as PDF | `itineraries/` |
| BLG-13 | Attach an itinerary to a post | `blog/` |
| BON-01 | Admin analytics (bookings and revenue per provider) | `admin/` |
| BON-02 | Favourites (hotels and public itineraries) | `favourites/` |

## Dependencies Between Areas

Every dependency between areas, with requirement codes, is in [milestone1/DEPENDENCIES.pdf](milestone1/DEPENDENCIES.pdf); each area's "you give / you need" table is also in [milestone1/TASKS.md](milestone1/TASKS.md) and on its handout. Until a dependency is merged, code against the agreed interface; for example, create test documents directly in the database.

## Timeline

Work starts on **31 October** (after midterms). Until then: everyone reads the requirements for their area, [CONVENTIONS.md](CONVENTIONS.md) and the skeleton files in their folders.

| Dates | Goal |
|---|---|
| 31 Oct – 1 Nov | Kickoff. Everyone clones the repo, runs it against the shared Atlas database and opens their first branch. |
| 2 – 5 Nov | Schemas and DTOs for every module (reviewed together for consistency). Shared `common/` code, login, guards and seed merged. |
| 6 – 10 Nov | CRUD, inventory management, search and listing endpoints. |
| 11 – 15 Nov | Holds, booking, payments and webhook, cancellations and refunds, exchange rates, moderation. |
| 16 – 18 Nov | End-to-end testing in Swagger with the seeded data; bug fixes; demo data; README. |
| 19 Nov | Feature freeze. Merge `develop` into `main` and tag `v1.0-milestone1`. |
| 20 Nov | Milestone 1 deadline. |

## Design Decisions

| Topic | Decision |
|---|---|
| Platform currency | `PLATFORM_CURRENCY` (USD). All prices, payments and refunds use it; only itinerary budgets are converted (PAY-04). |
| Money | Integer minor units (cents). |
| Sessions | 15-minute access JWT and refresh token in httpOnly cookies; refresh tokens hashed in the DB, rotated, revocable; 30-minute idle expiry (ACC-06, ACC-19). |
| Lockout | `failedLoginAttempts` + `lockUntil` on the user: 5 failures, 15 minutes (ACC-05). |
| Flight seat holds | One atomic `findOneAndUpdate` on the cabin that increments `held` only if `total - booked - held >= n` (FLT-22). |
| Hotel holds | A MongoDB transaction, or a room-night collection with a unique index on (roomId, date). All rooms or nothing (HTL-18). |
| Hold expiry | `holdExpiresAt` on the booking; a `@Cron` job every minute expires holds; expiry is also checked at payment time (GEN-11). |
| Status updates | Cron jobs set flights to Departed (FLT-30) and bookings to Completed (HTL-23, GEN-11). |
| Payments in Swagger | Backend creates the PaymentIntent. For the demo, it is confirmed with Stripe's test payment method `pm_card_visa`, so no card data reaches the backend. The webhook confirms the booking (PAY-01). |
| Time zones | UTC in the database; local time computed with the airport's IANA zone using `luxon` (FLT-03, GEN-06). |
| Uploads | Stored in `backend/uploads/` and served at `/uploads/...`; JPG/PNG only, 5 MB, 5 per item, 1 airline logo (GEN-08). |
| Exchange rates | Fetched once a day from FXRatesAPI, cached in MongoDB, last cached rates used if the API fails (ITN-18). |
| Reference data | Official ids are the `_id` values (`EG`, `cairo`, `CAI`, `att-1`). |

## Definition of Done (per requirement)

- [ ] Works end to end in Swagger with the seeded data.
- [ ] Validation and authorization enforced in the backend (wrong role → 403, other user's data → 404).
- [ ] Error cases from the requirement return clear messages.
- [ ] Lists are paginated (10 per page).
- [ ] Implemented exactly as documented in `docs/api/openapi.yaml` (or the file is updated in the same PR).
- [ ] Merged into `develop` through a reviewed PR.
- [ ] `AI_PROMPTS.txt` updated if AI was used.

## Demo Scenarios to Rehearse (15–18 Nov)

1. Register; log in; trigger the lockout after 5 wrong passwords.
2. Admin creates an airline and its moderator; the moderator changes the temporary password and creates a flight with cabins.
3. Round-trip search with an adult, a child and an infant; hold; accept policies; pay; confirmed with a reference and e-ticket.
4. Two simultaneous holds on the last seat: only one succeeds.
5. A hold expires after 10 minutes and its seats are released.
6. The user cancels: the refund tier is applied and the refund is visible.
7. The airline cancels a flight: 100% refunds and notifications.
8. Multi-room hotel booking; an overlapping request is rejected; a review after the stay.
9. Itinerary: add, reorder and delete days; budget summary in another currency; publish; another user clones it.
10. A post is reported, and the admin hides it; the audit log shows the action.
