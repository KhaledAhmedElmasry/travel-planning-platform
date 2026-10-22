# Milestone 1 Team Plan

**Deadline:** 20/11. **Evaluation:** through Swagger UI only. Every requirement must be demonstrable without a frontend.

## Work Areas

The backend is split into eight work areas. The team leader assigns people to areas outside this repository; the code and docs name areas, not people. Each file's header comment starts with `// Area: ...`.

| # | Area | Folders | Requirements |
|---|---|---|---|
| 1 | Foundation, Reference Data & Payments | `common/` (enums, filters, pipes, DTOs), `database/`, `reference-data/`, `payments/` | PAY-01..04, GEN-02, GEN-05, GEN-11, GEN-12, GEN-13, FLT-02, ACC-18, NEW-04, NEW-05 |
| 2 | Auth & Accounts | `auth/`, `users/`, `admin/`, `common/guards/`, `common/decorators/` | ACC-01, 03..09, 11..17, 19, NEW-07 |
| 3 | Community & Cross-cutting | `blog/`, `reports/`, `notifications/`, `audit/`, `uploads/` | BLG-01..12, GEN-01, 07..10 |
| 4 | Airlines & Flight Inventory | `airlines/`, `flights/` (except search), refund-tier rule in `common/utils/` | FLT-01, 03..09, 17, 29, 30, GEN-06, NEW-02 |
| 5 | Flight Search & Booking | `flights/flight-search.controller.ts`, `flight-bookings/` | FLT-11, 12, 15, 19, 21, 22, 23, 25, 26 |
| 6 | Hotels & Rooms | `hotels/` | HTL-01..06, 08..12, 15, 22 |
| 7 | Hotel Booking & Reviews | `hotel-bookings/`, `reviews/` | HTL-16..18, 20, 21, 23, 24 |
| 8 | Itineraries & Exchange Rates | `itineraries/`, `exchange-rates/` | ITN-01..26 |

Cross-cutting rules every area follows in its own module: GEN-02, 03, 04, 05, 11, 13.

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

| Who needs it | What | From area | Needed by |
|---|---|---|---|
| Every area | Error format, validation pipe, pagination types, shared enums | 1 Foundation | 2/11 |
| Every area | Login + cookies and the auth/roles guards, so protected routes can be tested in Swagger | 2 Auth | 3/11 |
| 4, 6, 8 | Reference data and seed (countries, cities, airports with time zones) | 1 Foundation | 3/11 |
| 4, 6 | Admin can create an airline/hotel and its moderator (ACC-13, FLT-01, HTL-01) | 2, 4, 6 | 4/11 |
| 5 | Flight + cabin schemas with seat counters (`total`, `booked`, `held`) | 4 Airlines | 4/11 |
| 7 | Hotel + room schemas and availability ranges | 6 Hotels | 4/11 |
| 2, 4, 5, 7 | Notifications service (GEN-01) and audit log service (GEN-07) | 3 Community | 6/11 |
| 3, 4, 6, 8 | Image upload validation (GEN-08) | 3 Community | 7/11 |
| 5, 7 | Cancellation-tier refund rule (FLT-09, HTL-10) | 4 Airlines | 7/11 |
| 8 | Hotel search (HTL-11) and flight search (FLT-11/12) services exported for reuse | 5, 6 | 10/11 |
| 3 | Post/comment/review/itinerary "hidden" flag for moderation (GEN-10) | 3, 7, 8 | 10/11 |
| 5, 7 | `PaymentsService` and the webhook confirming bookings | 1 Payments | 12/11 |

Until a dependency is merged, code against the agreed interface. For example, you can create test documents directly in the database.

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
| Platform currency | `PLATFORM_CURRENCY` (USD). All prices, payments and refunds use it; only itinerary budgets are converted (PAY-04, NEW-04). |
| Money | Integer minor units (cents). |
| Sessions | 15-minute access JWT and refresh token in httpOnly cookies; refresh tokens hashed in the DB, rotated, revocable; 30-minute idle expiry (ACC-06, ACC-19, NEW-07). |
| Lockout | `failedLoginAttempts` + `lockUntil` on the user: 5 failures, 15 minutes (ACC-05). |
| Flight seat holds | One atomic `findOneAndUpdate` on the cabin that increments `held` only if `total - booked - held >= n` (FLT-22). |
| Hotel holds | A MongoDB transaction, or a room-night collection with a unique index on (roomId, date). All rooms or nothing (HTL-18). |
| Hold expiry | `holdExpiresAt` on the booking; a `@Cron` job every minute expires holds; expiry is also checked at payment time (NEW-01). |
| Status updates | Cron jobs set flights to Departed (FLT-30) and bookings to Completed (HTL-23, NEW-01). |
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
