# Assumed Requirements (Not in the Official Workbook)

The project description and the official workbook (`Final_ SP1_Reviewed_Requirements.xlsx`) reference
the IDs below, but the workbook does not define them. Each definition here was **inferred from where
the ID is referenced** and is consistent with the rest of the workbook.

> **Resolved (Nov 2026): these ids are no longer used.** The updated project description and the
> updated official workbook replaced every reference with an existing requirement:
>
> | Old id | Now | Where |
> |---|---|---|
> | ACC-03 | ACC-01 | `POST /api/auth/register` is ACC-01 only |
> | BLG-11 | BLG-02, BLG-08 | dropped from `GET /api/posts` and `GET /api/tags/:tag/posts` |
> | NEW-01 | GEN-11 | dependency of ACC-12, FLT-22, HTL-18, HTL-23 |
> | NEW-02 | FLT-30 (FLT-05, FLT-06 themselves describe the effect on bookings) | dependency of FLT-05, FLT-06 |
> | NEW-04 | PAY-04 | ITN-18: "Booking prices are not converted (PAY-04)" |
> | NEW-05 | GEN-12 | dependency of FLT-02, HTL-01, ITN-01, ITN-05 |
> | NEW-07 | ACC-19 | dependency of ACC-06 |
>
> The code and `docs/api/openapi.yaml` use the new ids. The definitions below are kept only as a
> record of what was assumed before the update.

| ID | Module | Actor(s) | Referenced by | Complexity |
|---|---|---|---|---|
| ACC-03 | Accounts & Admin | System | PDF: `POST /api/auth/register` (with ACC-01) | Low |
| BLG-11 | Blog | Guest, Registered User | PDF: `GET /api/posts`, `GET /api/tags/:tag/posts` (with BLG-02, BLG-08, BLG-09) | Low |
| NEW-01 | Cross-cutting | System | ACC-12, FLT-22, HTL-18, HTL-23 | Medium |
| NEW-02 | Flights | System | FLT-05, FLT-06 | Medium |
| NEW-04 | Payments & Policies | System | ITN-18 ("Booking prices are not converted (NEW-04)") | Low |
| NEW-05 | Cross-cutting | System | FLT-02, HTL-01, ITN-01, ITN-05 | Low |
| NEW-07 | Accounts & Admin | System | ACC-06 | Medium |

---

## ACC-03 — Account Creation on Registration

**Requirement:** When a registration passes ACC-01 validation, the system shall create the account
with role *Registered User* and status *Active*, store the password only as a salted hash, and
enforce email uniqueness case-insensitively at the database level.

**Acceptance criteria**
- Email is trimmed and lowercased before saving; a unique index rejects duplicates, including concurrent ones (409 Conflict).
- The password is hashed (e.g. bcrypt, cost ≥ 10); the plain password is never stored, logged or returned.
- The role is always `USER`; any `role` field in the request body is ignored or rejected (no admin/moderator self-registration — ACC-18).
- The consent timestamp is stored with the account.
- The response (201) returns the created profile without any credential fields.

**Why this interpretation:** ACC-01 covers form validation, and the PDF pairs ACC-03 with it on the
register endpoint. The remaining registration behaviour is what happens after validation succeeds.

---

## BLG-11 — Browse Posts by Tag

**Requirement:** The system shall allow a guest or registered user to list the published posts that
have a given tag, paginated and newest first, by clicking a tag or using a tag filter.

**Acceptance criteria**
- Tags are normalised (trimmed, lowercased) on save, so matching is case-insensitive.
- Only published posts that are not hidden are returned, and never posts by deactivated authors (ACC-12, GEN-10).
- Results are paginated with page size 10 (GEN-05) and show title, author, date and excerpt.
- An unknown tag returns an empty list with a friendly empty state (GEN-04), not an error.
- Exposed both as `GET /api/tags/:tag/posts` and as `GET /api/posts?tag=...`.

**Why this interpretation:** The PDF lists BLG-11 only on the post-listing and tag endpoints, next to
BLG-08 (tags are clickable) and BLG-09 (search).

---

## NEW-01 — Booking Status Automation

**Requirement:** The system shall keep the status of flight bookings and hotel reservations up to
date automatically. It shall run a background job (at least once per minute) that:
- marks *Pending Payment* bookings whose 10-minute hold has passed as *Expired*, releases their
  held seats/rooms and cancels the related Stripe PaymentIntent;
- marks *Confirmed* hotel reservations as *Completed* once the check-out date has passed;
- marks *Confirmed* flight bookings as *Completed* once the (last segment's) flight has departed.

**Acceptance criteria**
- Each booking stores `status`, `holdExpiresAt`, and the timestamps of its status changes.
- Expiry is also checked at use time: an expired hold can never be paid or confirmed, even if the job has not run yet.
- A booking is "upcoming" when it is Confirmed and its departure/check-in date is in the future (used by ACC-12).
- Only the GEN-11 transitions are allowed; the job is safe to run repeatedly and in parallel.

**Why this interpretation:** Every requirement that depends on NEW-01 relies on booking states changing
over time: holds expiring (FLT-22, HTL-18), stays becoming Completed (HTL-23), and "upcoming Confirmed
bookings" (ACC-12).

---

## NEW-02 — Impact of Provider Changes on Existing Bookings

**Requirement:** When an airline moderator changes or cancels a flight, existing bookings shall be
updated consistently:
- each booking stores the **price agreed at booking time** (fare, baggage fees, total), so later price changes do not affect it;
- departure/arrival time changes apply to existing bookings, and passengers with *Confirmed* bookings are notified;
- cancelling a flight cancels all its *Confirmed* bookings with a 100% refund (PAY-03), expires all its *Pending Payment* bookings and releases their holds;
- for a round-trip booking, cancelling either segment's flight cancels the whole booking.

**Acceptance criteria**
- Flight changes and the resulting booking updates happen in one consistent operation (a transaction, or idempotent steps that can be retried).
- An airline moderator can change or cancel only flights of their assigned airline (ACC-11).
- Each affected user receives exactly one notification per change (GEN-01).

**Why this interpretation:** NEW-02 is referenced only by FLT-05 (edit times/prices) and FLT-06 (cancel flight).
Both describe the effect of a provider change on bookings that already exist.

---

## NEW-04 — Booking Amounts Stay in the Platform Currency

**Requirement:** Flight and hotel prices, booking totals, payments and refunds shall always be stored,
shown and charged in the single platform currency (PAY-04) and shall never be converted with
exchange rates. Currency conversion applies only to itinerary budget amounts (ITN-18).

**Acceptance criteria**
- The platform currency is a configuration value (e.g. `PLATFORM_CURRENCY=USD`) and is included with every price in API responses.
- A user's preferred currency (ACC-09) affects only itinerary budget displays.
- Stripe PaymentIntents and refunds use the platform currency.

**Why this interpretation:** ITN-18 states "Booking prices are not converted (NEW-04)".

---

## NEW-05 — Shared Reference Data (Countries and Cities)

**Requirement:** The system shall provide predefined, read-only lists of countries and cities loaded
from the official reference datasets (GEN-12). Airports, hotels and itineraries shall reference them by
their official identifiers, and only listed values are accepted.

**Acceptance criteria**
- Countries are keyed by `code` (e.g. `EG`) and cities by `city_id` (e.g. `cairo`), exactly as in the official datasets.
- Countries, cities (per country), airports (per city) and attractions (per city) can be read. Airports use `GET /api/airports`; the others may need extra endpoints (see "Endpoints" below).
- Creating or editing an airport (seed), hotel (HTL-01), itinerary (ITN-01) or itinerary day (ITN-05) with an unknown country/city is rejected with 400.
- A city must belong to the given country where both are provided.

**Why this interpretation:** Every requirement that depends on NEW-05 mentions a "predefined list" of
countries/cities (FLT-02, HTL-01, ITN-01, ITN-05).

---

## NEW-07 — Token-Based Session Management

**Requirement:** The system shall manage sessions with a short-lived access token and a refresh token,
both issued as httpOnly, Secure, SameSite cookies (ACC-19). Refresh tokens shall be stored only as hashes
on the server so they can be revoked, and shall be rotated on each refresh.

**Acceptance criteria**
- The access token expires after about 15 minutes; refreshing the session issues a new access token and a rotated refresh token (this may need an extra endpoint, see "Endpoints" below).
- A session that makes no authenticated request for 30 minutes cannot be refreshed and requires a new login (ACC-06).
- Logout revokes the refresh token on the server and clears both cookies.
- Suspending, deactivating or resetting the password of an account (ACC-07a, ACC-12, ACC-15, ACC-16) revokes all its sessions.
- Reusing a revoked or rotated refresh token is rejected (401).

**Why this interpretation:** ACC-06 depends on NEW-07 and requires revoking "the refresh token on the
server" and a 30-minute inactivity expiry.

---

## Endpoints

The PDF section 8 tables list no endpoint for these features, so extra endpoints may be needed:
refreshing the session (NEW-07) and reading countries, cities and attractions (NEW-05, GEN-12).
The team decides whether and how to add them; any new endpoint must be added to
`docs/api/openapi.yaml` in the same PR.
