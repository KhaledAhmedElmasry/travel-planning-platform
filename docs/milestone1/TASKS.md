# Milestone 1 Tasks

**Milestone 1:** NestJS backend + MongoDB, graded through Swagger UI.

Each work area has a handout with the same content: `area-<n>-*.md` in this folder. Every dependency between areas, with requirement codes, is in [DEPENDENCIES.pdf](DEPENDENCIES.pdf).

> The **Assigned to** tags are intentionally empty: the repository never names who works on what. Fill them in on your own copy or on the printed handouts.

Area 1 holds the hardest, most critical requirements (payments, holds, confirmation, refunds, booking automation). Areas 2-8 are balanced by difficulty (points: low = 1, medium = 2, high = 3), so an area with more requirements has easier ones.

## Overview

| # | Area | Assigned to | Requirements | Difficulty points | Endpoints | Tasks |
|---|---|---|---|---|---|---|
| 1 | Payments, Holds & Booking Engine | `________` | 14 | 29 | 12 | 10 |
| 2 | Auth & Sessions | `________` | 12 | 19 | 9 | 8 |
| 3 | Admin, Notifications & Platform Core | `________` | 14 | 19 | 9 | 8 |
| 4 | Blog, Reviews & Media | `________` | 15 | 19 | 19 | 8 |
| 5 | Airlines, Flights & Reference Data | `________` | 13 | 20 | 11 | 8 |
| 6 | Search & My Bookings | `________` | 12 | 20 | 12 | 8 |
| 7 | Hotels & Rooms | `________` | 12 | 21 | 12 | 8 |
| 8 | Itineraries & Exchange Rates | `________` | 13 | 21 | 24 | 8 |

Total: 105 requirements in Milestone 1. Frontend only (Milestone 2): ACC-10, GEN-03, GEN-14, GEN-15, GEN-16, GEN-17.

Rules every area follows in its own module: GEN-02 validation messages, GEN-04 empty lists, GEN-05 pagination (10 per page), GEN-11 booking lifecycle, GEN-13 backend enforces every rule.

## Area 1: Payments, Holds & Booking Engine

**Assigned to:** `________`

**Folders:** `payments/, flight-bookings/ (hold, confirm, cancel, e-ticket), hotel-bookings/ (booking, hold, confirm, cancel), booking cron jobs`

The hardest and most critical part of the platform: concurrency-safe seat and room holds, Stripe payments verified by webhook, booking confirmation, cancellations with policy-based refunds, and the automation that expires holds and completes bookings. Every booking demo depends on this area.

### Requirements

| Issue | Id | Requirement |
|---|---|---|
| #52 | PAY-01 | Pay for a Pending Payment flight booking or hotel reservation within… |
| #53 | PAY-02 | Before payment, the system shall show the provider's policies (airline… |
| #54 | PAY-03 | For every cancellation with a positive refund amount (user… |
| #93 | PAY-04 | All flight and hotel prices, payments and refunds shall use a single… |
| #116 | NEW-04 | Booking amounts stay in the platform currency; only itinerary budgets… |
| #27 | FLT-22 | When a user proceeds to payment, the system shall atomically reserve… |
| #44 | HTL-16 | Book one or more available rooms in the same hotel for the same dates… |
| #46 | HTL-18 | When a user proceeds to payment, the system shall hold all selected… |
| #28 | FLT-23 | After successful payment, the system shall set the flight booking to… |
| #45 | HTL-17 | After successful payment, the system shall set the reservation (all its… |
| #30 | FLT-26 | Cancel their own Confirmed flight booking any time before departure… |
| #48 | HTL-21 | Cancel their own Confirmed reservation as a whole before the check-in… |
| #90 | GEN-11 | Flight bookings and hotel reservations shall follow the lifecycle… |
| #114 | NEW-01 | Booking status automation: expire holds, mark stays/flights Completed |

### Endpoints

- [ ] `POST /api/flight-bookings/hold` FLT-22
- [ ] `POST /api/flight-bookings/:id/cancel` FLT-26
- [ ] `GET /api/flight-bookings/:id/e-ticket` FLT-23
- [ ] `POST /api/hotel-bookings` HTL-16, HTL-18
- [ ] `POST /api/hotel-bookings/:id/cancel` HTL-21
- [ ] `GET /api/bookings/:type/:id/policies` PAY-02
- [ ] `POST /api/bookings/:type/:id/accept-policies` PAY-02
- [ ] `POST /api/payments` PAY-01
- [ ] `POST /api/payments/:id/retry` PAY-01
- [ ] `GET /api/payments/:id` PAY-01
- [ ] `POST /api/payments/webhook` PAY-01
- [ ] `GET /api/refunds/:id` PAY-03

### Tasks

- [ ] Stripe in test mode: PaymentsService creates a PaymentIntent for a Pending Payment flight booking or hotel reservation. All amounts are integer cents of the platform currency USD (PAY-01, PAY-04, NEW-04). Never store card data.
- [ ] Policies before payment: show the airline or hotel policies for a booking and store the acceptance with a timestamp; refuse payment without it (PAY-02).
- [ ] Webhook: raw request body + Stripe signature verification. Only a verified successful payment confirms a booking; failed or expired payments leave it unconfirmed. Retry endpoint (PAY-01).
- [ ] Flight seat hold (FLT-22): ONE atomic findOneAndUpdate on the cabin that increments held only if total - booked - held >= n. holdExpiresAt = now + 10 minutes. Prove that two holds on the last seat cannot both succeed.
- [ ] Hotel booking + hold (HTL-16, HTL-18): one or more rooms of the same hotel for the same dates, all rooms or none, never overlapping (MongoDB transaction or a room-night collection with a unique index on roomId + date).
- [ ] Confirmation (FLT-23, HTL-17): the webhook moves Pending Payment -> Confirmed, generates the unique booking reference, and the flight e-ticket PDF download (add pdfkit or similar to package.json).
- [ ] Booking lifecycle (GEN-11) and automation (NEW-01): a @Cron job every minute expires holds and releases seats / room-nights, and marks finished trips and stays Completed. Expiry is re-checked at payment time.
- [ ] Cancellation + refunds (FLT-26, HTL-21, PAY-03): apply the cancellation tier rule (Area 5 tiers for flights, Area 7 tiers for hotels), release the inventory, create the Stripe refund and expose its status. Booking details show the refund the user would get before cancelling.
- [ ] Expose confirm / release / refund functions for Area 5 (flight cancellation by the airline gives 100% refunds) and call NotificationsService (Area 3) on confirmation, cancellation and refund.
- [ ] Rehearse demo scenarios 3-8 end to end in Swagger with the Stripe CLI forwarding webhooks.

### Dependencies

| Direction | Area | What |
|---|---|---|
| You give | Areas 3, 6 | Flight booking + hotel reservation schemas (admin overview, my bookings, flight manifest, reservation list) (GEN-11, ACC-17, FLT-29, HTL-22) |
| You give | Area 5 | Flight booking schema (no airport change or seat cut below booked; notify affected bookings) (GEN-11, FLT-05, NEW-02) |
| You give | Area 7 | Reservation + hold data (Booked in the room calendar, free rooms and search; no blocking over reservations) (HTL-18, HTL-06, HTL-08, HTL-11, HTL-15) |
| You give | Area 4 | Reservation schema with the Completed status (reviews only after a stay) (GEN-11, NEW-01, HTL-23) |
| You give | Area 6 | Refund preview in booking details (FLT-26, HTL-21) |
| You give | Area 5 | Refund function (airline cancels a flight: 100% refunds) (PAY-03, FLT-06) |
| You need | Area 3 | Error format, ValidationPipe, pagination, shared enums (GEN-02, GEN-05, GEN-13) |
| You need | Area 2 | User schema, login, cookies, JwtAuthGuard / RolesGuard / @CurrentUser, ownership helper (ACC-04, ACC-11, ACC-19) |
| You need | Area 3 | Raw request body for the Stripe webhook (main.ts) (PAY-01) |
| You need | Area 5 | Flight + cabin schemas with total / booked / held seat counters and flight status (FLT-03, FLT-04, FLT-30) |
| You need | Area 7 | Room + availability schemas (HTL-03, HTL-04, HTL-06) |
| You need | Area 3 | NotificationsService (GEN-01) |
| You need | Area 5 | Airline baggage + cancellation policies and the shared tier rule (shown before payment, used for refunds) (FLT-08, FLT-09, PAY-02) |
| You need | Area 7 | Hotel check-in / check-out times + cancellation tiers (shown before payment, used for refunds) (HTL-09, HTL-10, PAY-02) |
| You need | Area 6 | Booking summary (passengers, baggage) that hands off to the seat hold (FLT-19, FLT-21) |

**Demo scenarios to rehearse:** (3) Round-trip search with an adult, a child and an infant; hold; accept policies; pay; confirmed with a reference and e-ticket. (4) Two simultaneous holds on the last seat: only one succeeds. (5) A hold expires after 10 minutes and its seats are released. (6) The user cancels: the refund tier is applied and the refund is visible. (7) The airline cancels a flight: 100% refunds and notifications. (8) Multi-room hotel booking; an overlapping request is rejected; a review after the stay.

## Area 2: Auth & Sessions

**Assigned to:** `________`

**Folders:** `auth/, users/, common/guards/, common/decorators/`

Registration, login with secure cookies, sessions, roles and ownership checks for the whole team, the user profile and account self-service.

### Requirements

| Issue | Id | Requirement |
|---|---|---|
| #1 | ACC-01 | Register by entering name, unique email, password and a mandatory… |
| #112 | ACC-03 | Account creation on registration: role Registered User, status Active… |
| #120 | ACC-04 | Allow a registered user, admin or moderator to log in with email and… |
| #2 | ACC-05 | After 5 consecutive failed login attempts, the system shall lock the… |
| #3 | ACC-06 | Log out, which clears the authentication cookies and revokes the… |
| #4 | ACC-07a | Reset a user's or moderator's password to a temporary password |
| #5 | ACC-08 | Change their password by entering the current password and a new one… |
| #6 | ACC-09 | Edit name, phone number and preferred currency, saving only if all… |
| #8 | ACC-11 | Access to bookings and private itineraries to their owner, except that… |
| #121 | ACC-12 | Deactivate their own account after confirmation |
| #96 | ACC-19 | Never store authentication tokens or user credentials in localStorage… |
| #118 | NEW-07 | Token-based sessions: access + rotating refresh token in httpOnly… |

### Endpoints

- [ ] `POST /api/admin/users/:id/reset-password` ACC-07a
- [ ] `POST /api/auth/register` ACC-01, ACC-03
- [ ] `POST /api/auth/login` ACC-04, ACC-05
- [ ] `POST /api/auth/logout` ACC-06
- [ ] `PATCH /api/auth/change-password` ACC-08
- [ ] `GET /api/auth/me` ACC-04, ACC-11
- [ ] `GET /api/users/me` ACC-11
- [ ] `PATCH /api/users/me` ACC-09
- [ ] `DELETE /api/users/me` ACC-12
- [ ] An extra endpoint may be needed (not in the PDF tables) for: refreshing the session (NEW-07)

### Tasks

- [ ] User schema: name, unique lowercase email, bcrypt password hash, role, status (active / suspended / deactivated), preferred currency, failedLoginAttempts + lockUntil, assigned airline or hotel for moderators.
- [ ] Register (ACC-01, ACC-03): password rules, new account = Registered User + Active; admins can never self-register.
- [ ] Login / logout / session refresh (ACC-04, ACC-06, NEW-07): 15-minute access JWT + rotating, hashed refresh token in httpOnly, Secure, SameSite cookies only (ACC-19); 30-minute idle expiry; logout revokes the session.
- [ ] Lockout after 5 failed logins for 15 minutes; a successful login resets the counter (ACC-05).
- [ ] Guards for the whole team: JwtAuthGuard, RolesGuard + @Roles(), @CurrentUser(), and an ownership helper: users only see their own data, moderators only their provider (ACC-11). Suspended accounts are rejected on every request.
- [ ] Profile: GET / PATCH /api/users/me with validation of every field (ACC-09); change password with the current one (ACC-08).
- [ ] Deactivate own account after confirmation, revoking all sessions (ACC-12); admin resets a password to a temporary one that must be changed at next login (ACC-07a).
- [ ] Rehearse demo scenario 1 and test every guard: 401 without login, 403 with the wrong role, 404 for another user's data.

### Dependencies

| Direction | Area | What |
|---|---|---|
| You give | Every area | User schema, login, cookies, JwtAuthGuard / RolesGuard / @CurrentUser, ownership helper (ACC-04, ACC-11, ACC-19) |
| You give | Area 3 | Session revocation (used when an account is suspended) (NEW-07, ACC-15) |
| You need | Area 3 | Error format, ValidationPipe, pagination, shared enums (GEN-02, GEN-05, GEN-13) |
| You need | Area 5 | Seed data (countries, cities, airports with time zones, attractions, supported currencies) + lookups (GEN-12, NEW-05, FLT-02) |

**Bonus (only after every mandatory requirement is done):** ACC-02 (#101), ACC-07 (#102)

**Demo scenarios to rehearse:** (1) Register; log in; trigger the lockout after 5 wrong passwords.

## Area 3: Admin, Notifications & Platform Core

**Assigned to:** `________`

**Folders:** `main.ts, app.module.ts, common/ (filters, pipes, pagination, enums), config/, admin/, reports/, audit/, notifications/`

The shared base every module stands on (validation, error format, pagination) and all admin work: moderator accounts, suspensions, the bookings overview, content reports, moderation, the audit log and the in-app notification service.

### Requirements

| Issue | Id | Requirement |
|---|---|---|
| #81 | GEN-02 | Field-level validation messages on all forms |
| #83 | GEN-04 | Friendly empty states when a list or search has no results |
| #84 | GEN-05 | Paginate every list longer than 10 rows (page size 10) |
| #95 | GEN-13 | All validation, business rules and authorisation shall be enforced by… |
| #92 | ACC-18 | Admin accounts shall be created by seeding at setup; there is no admin… |
| #9 | ACC-13 | Create a hotel or airline moderator account (name, email, role) linked… |
| #10 | ACC-14 | View a paginated list of all accounts (name, email, role, status… |
| #11 | ACC-15 | Suspend and reactivate a moderator account (a suspended moderator… |
| #12 | ACC-16 | Suspend and reactivate registered users (for example, for abusive… |
| #13 | ACC-17 | View a read-only list of all flight and hotel bookings (reference… |
| #86 | GEN-07 | An audit log of admin actions (suspensions, deletions) |
| #88 | GEN-09 | Report a post, comment, review or itinerary with a reason, at most once… |
| #89 | GEN-10 | View the list of open reports and resolve each by dismissing it, hiding… |
| #80 | GEN-01 | In-app notifications (unread count, notification list, mark as read)… |

### Endpoints

- [ ] `POST /api/admin/moderators` ACC-13
- [ ] `GET /api/admin/accounts` ACC-14
- [ ] `PATCH /api/admin/accounts/:id/suspend` ACC-15, ACC-16
- [ ] `PATCH /api/admin/accounts/:id/reactivate` ACC-15, ACC-16
- [ ] `GET /api/admin/bookings` ACC-17
- [ ] `GET /api/admin/audit-logs` GEN-07
- [ ] `GET /api/admin/reports` GEN-09, GEN-10
- [ ] `PATCH /api/admin/reports/:id` GEN-10
- [ ] `DELETE /api/admin/content/:type/:id` GEN-10
- [ ] An extra endpoint may be needed (not in the PDF tables) for: the notification list, unread count and mark as read (GEN-01)
- [ ] An extra endpoint may be needed (not in the PDF tables) for: deactivating / reactivating a hotel or airline (ACC-15)
- [ ] An extra endpoint may be needed (not in the PDF tables) for: a registered user reporting content (GEN-09)
- [ ] An extra endpoint may be needed (not in the PDF tables) for: the admin hiding content directly (GEN-10)

### Tasks

- [ ] main.ts / app.module.ts: cookie-parser, CORS, ScheduleModule.forRoot(), raw body for the payment webhook, static /uploads.
- [ ] Global ValidationPipe with field-level errors (GEN-02) and a global exception filter using the error format in docs/api/README.md, so every rule is enforced by the backend with clear errors (GEN-13).
- [ ] common/: pagination query DTO + helper returning {items, page, pageSize, total, totalPages}, page size 10 (GEN-05); empty lists return items: [] (GEN-04); shared enums; env.validation.ts kept in sync with .env.example.
- [ ] NotificationsService (exported) + the current user's notification list, unread count and mark as read (GEN-01).
- [ ] Seed the admin account (ACC-18) with Area 5. Moderators (ACC-13): admin creates a hotel or airline moderator with a temporary password, linked to exactly one provider. Accounts list with filters and pagination (ACC-14).
- [ ] Suspend / reactivate users and moderators, revoking their sessions (ACC-15, ACC-16); deactivate / reactivate a hotel or airline (ACC-15). Admin bookings overview, read-only (ACC-17).
- [ ] Reports: a user reports a post, comment, review or itinerary at most once (GEN-09); admin lists, dismisses, hides or deletes (GEN-10). Agree the "hidden" flag with Areas 4 and 8.
- [ ] AuditService (exported) + GET /api/admin/audit-logs (GEN-07); every admin action writes an entry. Rehearse demo scenario 10.

### Dependencies

| Direction | Area | What |
|---|---|---|
| You give | Every area | Error format, ValidationPipe, pagination, shared enums (GEN-02, GEN-05, GEN-13) |
| You give | Area 1 | Raw request body for the Stripe webhook (main.ts) (PAY-01) |
| You give | Areas 5, 7 | Admin creates the airline / hotel moderator (ACC-13) |
| You give | Areas 1, 5 | NotificationsService (GEN-01) |
| You need | Area 2 | User schema, login, cookies, JwtAuthGuard / RolesGuard / @CurrentUser, ownership helper (ACC-04, ACC-11, ACC-19) |
| You need | Area 5 | Seed script where the admin account is added (GEN-12, ACC-18) |
| You need | Area 5 | Airline schema (a moderator is linked to one airline; airlines can be deactivated) (FLT-01, ACC-13, ACC-15) |
| You need | Area 7 | Hotel schema (a moderator is linked to one hotel; hotels can be deactivated) (HTL-01, ACC-13, ACC-15) |
| You need | Area 2 | Session revocation (used when an account is suspended) (NEW-07, ACC-15) |
| You need | Area 1 | Flight booking + hotel reservation schemas (admin overview, my bookings, flight manifest, reservation list) (GEN-11, ACC-17, FLT-29, HTL-22) |
| You need | Area 4 | Post, comment and review schemas with a hidden flag (GEN-09, GEN-10) |
| You need | Area 8 | Itinerary schema with a hidden flag (GEN-09, GEN-10) |

**Bonus (only after every mandatory requirement is done):** BON-01 (#110), GEN-01-B (#103)

**Demo scenarios to rehearse:** (10) A post is reported, and the admin hides it; the audit log shows the action.

## Area 4: Blog, Reviews & Media

**Assigned to:** `________`

**Folders:** `blog/, reviews/, uploads/`

All community content: the blog (posts, drafts, tags, search, comments, likes, author pages), hotel reviews and ratings, and the image-upload validation that every area with photos uses.

### Requirements

| Issue | Id | Requirement |
|---|---|---|
| #70 | BLG-01 | Create a post with a required title and body, optional tags and images… |
| #71 | BLG-02 | Browse a paginated list of published posts filterable by tag, and open… |
| #72 | BLG-03 | List their own posts, including drafts, with title, status, date, like… |
| #73 | BLG-04 | Edit and delete their own posts |
| #74 | BLG-05 | Comment on a published post (non-empty, max 500 characters), shown in… |
| #75 | BLG-06 | Like a post once and remove the like, showing the like count |
| #76 | BLG-07 | Edit and delete their own comments |
| #77 | BLG-08 | Add up to 5 tags (max 30 characters each) to a post and edit them later |
| #122 | BLG-09 | Search published posts by keyword in title, tags or author name… |
| #78 | BLG-10 | Attach images to a post under the shared media-upload rule (GEN-08) and… |
| #113 | BLG-11 | Browse published posts by tag (case-insensitive, paginated, newest… |
| #79 | BLG-12 | A public author page showing the author's name, join date, published… |
| #87 | GEN-08 | Image uploads in JPG or PNG format, up to 5 MB each, with up to 5… |
| #50 | HTL-23 | A Confirmed reservation becomes Completed once its check-out date has… |
| #51 | HTL-24 | View a hotel's average rating, number of ratings and reviews (newest… |

### Endpoints

- [ ] `POST /api/posts` BLG-01
- [ ] `GET /api/posts` BLG-02, BLG-09, BLG-11
- [ ] `GET /api/posts/:id` BLG-02
- [ ] `GET /api/posts/mine` BLG-03
- [ ] `PATCH /api/posts/:id` BLG-04, BLG-08
- [ ] `DELETE /api/posts/:id` BLG-04
- [ ] `POST /api/posts/:id/comments` BLG-05
- [ ] `PATCH /api/comments/:id` BLG-07
- [ ] `DELETE /api/comments/:id` BLG-07
- [ ] `POST /api/posts/:id/like` BLG-06
- [ ] `DELETE /api/posts/:id/like` BLG-06
- [ ] `POST /api/posts/:id/images` BLG-10, GEN-08
- [ ] `DELETE /api/posts/:id/images/:imageId` BLG-10
- [ ] `GET /api/tags/:tag/posts` BLG-08, BLG-11
- [ ] `GET /api/authors/:id` BLG-12
- [ ] `POST /api/hotel-bookings/:id/review` HTL-23
- [ ] `PATCH /api/reviews/:id` HTL-23
- [ ] `DELETE /api/reviews/:id` HTL-23
- [ ] `GET /api/hotels/:id/reviews` HTL-24

### Tasks

- [ ] Upload validation shared by everyone: JPG / PNG only, max 5 MB, max 5 images per item, stored in backend/uploads/ and served at /uploads (GEN-08).
- [ ] Post schema + create as Draft or Published with a required title and body (BLG-01).
- [ ] Public paginated list and detail of published posts (BLG-02); my posts including drafts (BLG-03); edit / delete own posts (BLG-04).
- [ ] Tags: up to 5 per post, max 30 characters, normalised (BLG-08); browse by tag, case-insensitive (BLG-11); keyword search in title, tags or author (BLG-09).
- [ ] Post images with the shared upload rule: add and remove (BLG-10).
- [ ] Comments: add, edit / delete own (BLG-05, BLG-07). Likes: at most one per user per post with a unique index (BLG-06).
- [ ] Public author page (BLG-12); hidden posts and comments (GEN-10, Area 3) are excluded from public lists.
- [ ] Hotel reviews (HTL-23): only for a Completed stay, one per reservation, edit / delete own; hotel average rating, count and list, newest first (HTL-24); hidden flag (GEN-10).

### Dependencies

| Direction | Area | What |
|---|---|---|
| You give | Areas 5, 7, 8 | Image upload validation (GEN-08) |
| You give | Area 3 | Post, comment and review schemas with a hidden flag (GEN-09, GEN-10) |
| You need | Area 3 | Error format, ValidationPipe, pagination, shared enums (GEN-02, GEN-05, GEN-13) |
| You need | Area 2 | User schema, login, cookies, JwtAuthGuard / RolesGuard / @CurrentUser, ownership helper (ACC-04, ACC-11, ACC-19) |
| You need | Area 7 | Hotel schema (reviews and the reservation list belong to a hotel) (HTL-01, HTL-22, HTL-24) |
| You need | Area 1 | Reservation schema with the Completed status (reviews only after a stay) (GEN-11, NEW-01, HTL-23) |

**Bonus (only after every mandatory requirement is done):** BLG-13 (#109), HTL-26 (#106)

**Demo scenarios to rehearse:** (8) Multi-room hotel booking; an overlapping request is rejected; a review after the stay. (10) A post is reported, and the admin hides it; the audit log shows the action.

## Area 5: Airlines, Flights & Reference Data

**Assigned to:** `________`

**Folders:** `database/ (seed), reference-data/, airlines/, flights/ (inventory), refund-tier rule in common/utils/`

The official reference data every module relies on, airline profiles and policies, and flight inventory with cabins and seat counters that Area 1 holds seats on.

### Requirements

| Issue | Id | Requirement |
|---|---|---|
| #94 | GEN-12 | Reference data at setup: airports, cities, countries and supported… |
| #117 | NEW-05 | Shared reference data (countries, cities) with read endpoints and… |
| #15 | FLT-02 | A predefined, read-only list of airports (IATA code, name, city… |
| #14 | FLT-01 | Create an airline profile and an airline moderator to edit their… |
| #16 | FLT-03 | Create a flight with flight number, departure and arrival airports, and… |
| #17 | FLT-04 | Define cabin categories per flight from the fixed set {Economy, Premium… |
| #18 | FLT-05 | Edit departure/arrival times, cabin prices and cabin seat counts of… |
| #19 | FLT-06 | Cancel a Scheduled flight after confirmation |
| #20 | FLT-08 | Define a price per extra bag (>0) and a maximum number of extra bags… |
| #21 | FLT-09 | Define cancellation tiers, each with a unique days-before-departure… |
| #91 | FLT-30 | Flights shall have a status of Scheduled, Cancelled or Departed |
| #85 | GEN-06 | Flight times in each airport's local time zone |
| #115 | NEW-02 | Impact of flight changes/cancellation on existing bookings |

### Endpoints

- [ ] `POST /api/airlines` FLT-01
- [ ] `GET /api/airlines/:id` FLT-01
- [ ] `PATCH /api/airlines/:id` FLT-01
- [ ] `PUT /api/airlines/:id/baggage-policy` FLT-04, FLT-08
- [ ] `PUT /api/airlines/:id/cancellation-policy` FLT-09
- [ ] `POST /api/flights` FLT-03
- [ ] `PATCH /api/flights/:id` FLT-05
- [ ] `POST /api/flights/:id/cancel` FLT-06
- [ ] `POST /api/flights/:id/cabins` FLT-04
- [ ] `PATCH /api/flights/:id/cabins/:cabinId` FLT-04, FLT-05
- [ ] `GET /api/airports` FLT-03, FLT-11
- [ ] An extra endpoint may be needed (not in the PDF tables) for: reading countries, cities, attractions and the supported currency list (NEW-05, GEN-12, ACC-09, ITN-18)

### Tasks

- [ ] Seed script (npm run seed): countries, cities, airports and attractions from the official datasets with the official ids (EG, cairo, CAI, att-1), an IANA time zone added to every airport (FLT-02), and the supported currencies (GEN-12). Running it twice creates no duplicates.
- [ ] Exported reference lookups so other modules reject unknown countries, cities and airports (NEW-05).
- [ ] Airline schema + endpoints: admin creates, the airline's moderator edits; logo as multipart, 1 per airline (FLT-01).
- [ ] Extra-baggage rules (FLT-08) and cancellation tiers (FLT-09); the shared tier rule in common/utils/ for Area 1.
- [ ] Flight schema with airports validated by the lookups, times stored in UTC and shown in each airport's local zone with luxon (FLT-03, GEN-06).
- [ ] Cabins with prices and total / booked / held seat counters, so Area 1 can hold seats atomically (FLT-04).
- [ ] Edit the schedule and notify affected bookings (FLT-05, NEW-02); cancel a flight: its bookings are cancelled with 100% refunds through Area 1 (FLT-06).
- [ ] Flight status Scheduled / Cancelled / Departed, with a cron job that marks flights Departed (FLT-30). Rehearse demo scenarios 2 and 7.

### Dependencies

| Direction | Area | What |
|---|---|---|
| You give | Areas 2, 6, 7, 8 | Seed data (countries, cities, airports with time zones, attractions, supported currencies) + lookups (GEN-12, NEW-05, FLT-02) |
| You give | Area 3 | Seed script where the admin account is added (GEN-12, ACC-18) |
| You give | Area 3 | Airline schema (a moderator is linked to one airline; airlines can be deactivated) (FLT-01, ACC-13, ACC-15) |
| You give | Area 1 | Flight + cabin schemas with total / booked / held seat counters and flight status (FLT-03, FLT-04, FLT-30) |
| You give | Area 6 | Flight + cabin schemas, baggage allowance and the local-time helper (search and flight details) (FLT-03, FLT-04, FLT-08, GEN-06) |
| You give | Area 1 | Airline baggage + cancellation policies and the shared tier rule (shown before payment, used for refunds) (FLT-08, FLT-09, PAY-02) |
| You need | Area 3 | Error format, ValidationPipe, pagination, shared enums (GEN-02, GEN-05, GEN-13) |
| You need | Area 2 | User schema, login, cookies, JwtAuthGuard / RolesGuard / @CurrentUser, ownership helper (ACC-04, ACC-11, ACC-19) |
| You need | Area 3 | Admin creates the airline / hotel moderator (ACC-13) |
| You need | Area 3 | NotificationsService (GEN-01) |
| You need | Area 1 | Flight booking schema (no airport change or seat cut below booked; notify affected bookings) (GEN-11, FLT-05, NEW-02) |
| You need | Area 4 | Image upload validation (GEN-08) |
| You need | Area 1 | Refund function (airline cancels a flight: 100% refunds) (PAY-03, FLT-06) |

**Demo scenarios to rehearse:** (2) Admin creates an airline and its moderator; the moderator changes the temporary password and creates a flight with cabins. (7) The airline cancels a flight: 100% refunds and notifications.

## Area 6: Search & My Bookings

**Assigned to:** `________`

**Folders:** `flights/flight-search.controller.ts, flights/ (details, manifest), flight-bookings/ (summary, lists), hotel-bookings/ (lists), hotels/ (reservations list)`

Everything around finding and listing bookings: flight search, flight details, the booking summary, "my bookings" lists, the moderators' flight manifest and hotel reservation list, and search from an itinerary.

### Requirements

| Issue | Id | Requirement |
|---|---|---|
| #123 | FLT-11 | Search flights by selecting a departure airport, arrival airport… |
| #22 | FLT-12 | Support: (a) round-trip search returning outbound and return options… |
| #23 | FLT-15 | Filter flight results by an inclusive minimum and maximum price while… |
| #24 | FLT-17 | A flight details page showing airline, flight number, airports, local… |
| #25 | FLT-19 | Allow a registered user, during booking, to enter each passenger's full… |
| #26 | FLT-21 | A booking summary (flight, passengers, baggage, total) before payment |
| #29 | FLT-25 | View their flight bookings grouped as Upcoming, Past and Cancelled… |
| #31 | FLT-29 | View, per flight, its bookings (reference, passenger names, cabin… |
| #47 | HTL-20 | View their hotel reservations grouped as Upcoming, Past and Cancelled… |
| #49 | HTL-22 | View reservations for their hotel (guest, dates, status) |
| #68 | ITN-25 | Pick a city group in their itinerary and view hotels available for that… |
| #69 | ITN-26 | Search one-way or round-trip flights from a chosen origin airport to… |

### Endpoints

- [ ] `POST /api/flight-bookings` FLT-19, FLT-21
- [ ] `GET /api/flight-bookings` FLT-25
- [ ] `GET /api/flight-bookings/:id` FLT-25
- [ ] `GET /api/flights/search` FLT-11, FLT-12, FLT-15
- [ ] `GET /api/flights/:id` FLT-17
- [ ] `GET /api/flights/:id/bookings` FLT-29
- [ ] `GET /api/flights/:id/passengers/export` FLT-29
- [ ] `GET /api/hotel-bookings` HTL-20
- [ ] `GET /api/hotel-bookings/:id` HTL-20
- [ ] `GET /api/hotels/:id/reservations` HTL-22
- [ ] `GET /api/itineraries/:id/hotels` ITN-09 (built for ITN-25)
- [ ] `GET /api/itineraries/:id/flights` ITN-26

### Tasks

- [ ] Flight search one-way and round-trip by route, dates, passenger types (adult / child / infant) and cabin (FLT-11, FLT-12), with price filter and sorting (FLT-15). Export the search service.
- [ ] Flight details with local airport times (FLT-17).
- [ ] Booking summary (FLT-19, FLT-21): passengers, baggage and price breakdown, then hand off to Area 1's seat hold.
- [ ] My flight bookings (FLT-25) and my hotel reservations (HTL-20), grouped Upcoming / Past / Cancelled, with the refund preview from Area 1.
- [ ] Moderator view of a flight's bookings and the passenger CSV export (FLT-29).
- [ ] Hotel moderator's reservation list for their hotel, filtered and paginated (HTL-22).
- [ ] From an itinerary: hotels for a city group using Area 7's hotel search (ITN-25) and flights using your flight search (ITN-26).
- [ ] Rehearse demo scenarios 3 and 8 together with Area 1.

### Dependencies

| Direction | Area | What |
|---|---|---|
| You give | Area 1 | Booking summary (passengers, baggage) that hands off to the seat hold (FLT-19, FLT-21) |
| You need | Area 3 | Error format, ValidationPipe, pagination, shared enums (GEN-02, GEN-05, GEN-13) |
| You need | Area 2 | User schema, login, cookies, JwtAuthGuard / RolesGuard / @CurrentUser, ownership helper (ACC-04, ACC-11, ACC-19) |
| You need | Area 5 | Seed data (countries, cities, airports with time zones, attractions, supported currencies) + lookups (GEN-12, NEW-05, FLT-02) |
| You need | Area 7 | Hotel schema (reviews and the reservation list belong to a hotel) (HTL-01, HTL-22, HTL-24) |
| You need | Area 5 | Flight + cabin schemas, baggage allowance and the local-time helper (search and flight details) (FLT-03, FLT-04, FLT-08, GEN-06) |
| You need | Area 1 | Flight booking + hotel reservation schemas (admin overview, my bookings, flight manifest, reservation list) (GEN-11, ACC-17, FLT-29, HTL-22) |
| You need | Area 8 | Itinerary schema (days and city groups) (ITN-05, ITN-09) |
| You need | Area 7 | Exported hotel search service (HTL-11, ITN-25) |
| You need | Area 1 | Refund preview in booking details (FLT-26, HTL-21) |

**Bonus (only after every mandatory requirement is done):** FLT-27 (#104), FLT-28 (#105)

**Demo scenarios to rehearse:** (3) Round-trip search with an adult, a child and an infant; hold; accept policies; pay; confirmed with a reference and e-ticket. (8) Multi-room hotel booking; an overlapping request is rejected; a review after the stay.

## Area 7: Hotels & Rooms

**Assigned to:** `________`

**Folders:** `hotels/`

Hotel profiles and photos, individually bookable rooms, availability and blocked dates, policies, and hotel search. Area 1 books rooms on top of your schemas.

### Requirements

| Issue | Id | Requirement |
|---|---|---|
| #32 | HTL-01 | Create a hotel profile and a hotel moderator to edit their hotel's… |
| #33 | HTL-02 | A hotel details page showing the hotel profile, photos, amenities… |
| #34 | HTL-03 | Add a room (an individually bookable unit) with a room number/name… |
| #35 | HTL-04 | Define non-overlapping date ranges when a room is bookable |
| #36 | HTL-05 | Edit a room's beds, occupancy, price and availability |
| #37 | HTL-06 | Block date ranges for a room and to deactivate or delete a room |
| #38 | HTL-08 | View each room's status for a chosen date range as Available, Booked… |
| #39 | HTL-09 | Set the hotel's standard check-in and check-out times, shown on the… |
| #40 | HTL-10 | Define cancellation tiers, each with a unique days-before-check-in… |
| #41 | HTL-11 | Search hotels by city or country, check-in date, check-out date, number… |
| #42 | HTL-12 | Filter hotel results by an inclusive minimum and maximum price per… |
| #43 | HTL-15 | View all of a hotel's rooms that are free for the searched dates… |

### Endpoints

- [ ] `POST /api/hotels` HTL-01
- [ ] `GET /api/hotels/search` HTL-11, HTL-12
- [ ] `GET /api/hotels/:id` HTL-02
- [ ] `PATCH /api/hotels/:id` HTL-01
- [ ] `POST /api/hotels/:id/rooms` HTL-03
- [ ] `PATCH /api/hotels/:id/rooms/:roomId` HTL-05
- [ ] `DELETE /api/hotels/:id/rooms/:roomId` HTL-06
- [ ] `GET /api/hotels/:id/rooms/available` HTL-15
- [ ] `POST /api/hotels/:id/rooms/:roomId/availability` HTL-04
- [ ] `PATCH /api/hotels/:id/rooms/:roomId/availability` HTL-05, HTL-06
- [ ] `GET /api/hotels/:id/availability` HTL-08
- [ ] `PUT /api/hotels/:id/policies` HTL-08, HTL-10

### Tasks

- [ ] Hotel schema + endpoints: admin creates, only the hotel's moderator edits; city / country validated with the lookups; photos as multipart, max 5 (HTL-01).
- [ ] Hotel details with photos, amenities, policies and rooms (HTL-02).
- [ ] Rooms: add (HTL-03), edit (HTL-05), deactivate with active: false or delete only if never reserved (HTL-06).
- [ ] Availability ranges (HTL-04) and blocked dates (HTL-06) per room; room status calendar for a date range (HTL-08).
- [ ] Policies: check-in / check-out times (HTL-09) and cancellation tiers (HTL-10) through PUT /api/hotels/:id/policies.
- [ ] Hotel search by destination, dates and guests (HTL-11) with price filter and sorting (HTL-12). Export the search service.
- [ ] Free rooms for the searched dates (HTL-15).
- [ ] Room + availability schemas ready for Area 1's booking and hold. Rehearse demo scenario 8 with Area 1.

### Dependencies

| Direction | Area | What |
|---|---|---|
| You give | Area 3 | Hotel schema (a moderator is linked to one hotel; hotels can be deactivated) (HTL-01, ACC-13, ACC-15) |
| You give | Areas 4, 6 | Hotel schema (reviews and the reservation list belong to a hotel) (HTL-01, HTL-22, HTL-24) |
| You give | Area 1 | Room + availability schemas (HTL-03, HTL-04, HTL-06) |
| You give | Area 1 | Hotel check-in / check-out times + cancellation tiers (shown before payment, used for refunds) (HTL-09, HTL-10, PAY-02) |
| You give | Area 6 | Exported hotel search service (HTL-11, ITN-25) |
| You need | Area 3 | Error format, ValidationPipe, pagination, shared enums (GEN-02, GEN-05, GEN-13) |
| You need | Area 2 | User schema, login, cookies, JwtAuthGuard / RolesGuard / @CurrentUser, ownership helper (ACC-04, ACC-11, ACC-19) |
| You need | Area 5 | Seed data (countries, cities, airports with time zones, attractions, supported currencies) + lookups (GEN-12, NEW-05, FLT-02) |
| You need | Area 3 | Admin creates the airline / hotel moderator (ACC-13) |
| You need | Area 1 | Reservation + hold data (Booked in the room calendar, free rooms and search; no blocking over reservations) (HTL-18, HTL-06, HTL-08, HTL-11, HTL-15) |
| You need | Area 4 | Image upload validation (GEN-08) |

**Bonus (only after every mandatory requirement is done):** BON-02 (#111)

**Demo scenarios to rehearse:** (8) Multi-room hotel booking; an overlapping request is rejected; a review after the stay.

## Area 8: Itineraries & Exchange Rates

**Assigned to:** `________`

**Folders:** `itineraries/, exchange-rates/`

Day-by-day itineraries with activities, images, budgets and transport costs, currency conversion through FXRatesAPI, and public search and cloning.

### Requirements

| Issue | Id | Requirement |
|---|---|---|
| #55 | ITN-01 | Create an itinerary with a required title (max 100 characters), one or… |
| #56 | ITN-03 | List their itineraries (title, countries, start date, days and… |
| #57 | ITN-05 | Add days to their itinerary and edit each day's city (selected from the… |
| #58 | ITN-07 | Delete a day after confirmation |
| #59 | ITN-08 | Move a day to a new position, with days renumbered and dates and… |
| #60 | ITN-09 | Each itinerary day to have a city and shall display consecutive days in… |
| #61 | ITN-10 | Add, edit and delete activities for an itinerary day, including name… |
| #62 | ITN-12 | Attach images to and remove images from an activity under the shared… |
| #63 | ITN-14 | Add, edit and delete non-negative budget entries for each day across… |
| #64 | ITN-16 | Add, edit and delete a transport cost entry (mode, from-city, to-city… |
| #65 | ITN-18 | All itinerary budget amounts to the user's preferred currency (from the… |
| #66 | ITN-20 | Set an itinerary's visibility to Public or Private |
| #67 | ITN-21 | Search public itineraries by keyword matching title, country or city… |

### Endpoints

- [ ] `POST /api/itineraries` ITN-01
- [ ] `GET /api/itineraries` ITN-03
- [ ] `GET /api/itineraries/:id` ITN-03
- [ ] `PATCH /api/itineraries/:id` ITN-01, ITN-20
- [ ] `DELETE /api/itineraries/:id` ITN-01
- [ ] `POST /api/itineraries/:id/days` ITN-05
- [ ] `PATCH /api/itineraries/:id/days/:dayId` ITN-05
- [ ] `DELETE /api/itineraries/:id/days/:dayId` ITN-07
- [ ] `PATCH /api/itineraries/:id/days/reorder` ITN-08
- [ ] `POST /api/itineraries/:id/days/:dayId/activities` ITN-10
- [ ] `PATCH /api/activities/:id` ITN-10
- [ ] `DELETE /api/activities/:id` ITN-10
- [ ] `POST /api/activities/:id/images` ITN-12, GEN-08
- [ ] `DELETE /api/activities/:id/images/:imageId` ITN-12
- [ ] `POST /api/itineraries/:id/days/:dayId/budgets` ITN-14
- [ ] `PATCH /api/budgets/:id` ITN-14
- [ ] `DELETE /api/budgets/:id` ITN-14
- [ ] `POST /api/itineraries/:id/transport-costs` ITN-16
- [ ] `PATCH /api/transport-costs/:id` ITN-16
- [ ] `DELETE /api/transport-costs/:id` ITN-16
- [ ] `GET /api/itineraries/:id/budget-summary` ITN-14, ITN-18
- [ ] `GET /api/itineraries/public/search` ITN-20, ITN-21
- [ ] `GET /api/itineraries/public/:id` ITN-21
- [ ] `POST /api/itineraries/:id/clone` ITN-21

### Tasks

- [ ] Itinerary schema: title, countries, start date, ordered days (date = start date + position), cities, activities, images, budget entries, transport costs, visibility, cloned-from attribution, hidden flag.
- [ ] Create / list / view / edit / delete own itineraries with ownership checks (ITN-01, ITN-03).
- [ ] Days: add and edit (ITN-05), delete (ITN-07), reorder (ITN-08); every change renumbers days, recomputes dates and city groups (ITN-09) and budgets.
- [ ] Activities (ITN-10) with images under the shared upload rule (ITN-12).
- [ ] Budget entries for food, accommodation, local transport and activities (ITN-14); intercity transport costs (ITN-16).
- [ ] Exchange rates (ITN-18): FXRatesAPI called by the backend only, cached once a day in MongoDB, last cached rates if the API fails, clear errors for invalid currencies; budget summary in the display currency.
- [ ] Visibility public / private (ITN-20); public search, view and clone into a private copy that keeps attribution (ITN-21).
- [ ] Add FXRATES_API_KEY to env.validation.ts and .env.example. Rehearse demo scenario 9.

### Dependencies

| Direction | Area | What |
|---|---|---|
| You give | Area 6 | Itinerary schema (days and city groups) (ITN-05, ITN-09) |
| You give | Area 3 | Itinerary schema with a hidden flag (GEN-09, GEN-10) |
| You need | Area 3 | Error format, ValidationPipe, pagination, shared enums (GEN-02, GEN-05, GEN-13) |
| You need | Area 2 | User schema, login, cookies, JwtAuthGuard / RolesGuard / @CurrentUser, ownership helper (ACC-04, ACC-11, ACC-19) |
| You need | Area 5 | Seed data (countries, cities, airports with time zones, attractions, supported currencies) + lookups (GEN-12, NEW-05, FLT-02) |
| You need | Area 4 | Image upload validation (GEN-08) |

**Bonus (only after every mandatory requirement is done):** ITN-27 (#107), ITN-28 (#108)

**Demo scenarios to rehearse:** (9) Itinerary: add, reorder and delete days; budget summary in another currency; publish; another user clones it.

## Definition of Done (every requirement)

- [ ] Works end to end in Swagger with the seeded data.
- [ ] Validation and authorization in the backend (wrong input 400, not logged in 401, wrong role 403, another user's data 404).
- [ ] Every rule and error case in the issue is handled with a clear message.
- [ ] Lists are paginated (10 per page).
- [ ] Matches docs/api/openapi.yaml, or the file is updated in the same PR.
- [ ] Merged into develop through a reviewed PR that says "Closes #<issue>".
- [ ] AI_PROMPTS.txt updated if AI was used.
