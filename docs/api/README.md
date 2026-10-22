# API Documentation

All Swagger documentation is in one file: [openapi.yaml](openapi.yaml) (OpenAPI 3.0). The backend loads it
in `main.ts`, and Swagger UI shows it at http://localhost:3000/api/docs (raw JSON at `/api/docs-json`).

It documents every endpoint of PDF section 8, grouped and ordered like the PDF tables, with:
the requirement IDs in each summary, who may call it, the rules from the requirements workbook, the parameters,
the request body fields with examples, and the possible responses. Optional endpoints are marked `[Bonus]`.

An endpoint that is not implemented yet returns `404 Cannot ...` in "Try it out".

## Working With the File

- **Implement an endpoint exactly as documented**: same method, path, field names, status codes.
- **Changing or adding an endpoint?** Update `openapi.yaml` in the same pull request. Copy a similar endpoint
  as a template, and put the requirement IDs at the end of the summary.
- Endpoints that need login have `security: *auth`; public endpoints have `security: []`.
- The server reads the file when it starts. After editing it, restart `npm run start:dev` to see the change.
- Check the file before committing:
  ```bash
  npx @redocly/cli lint docs/api/openapi.yaml
  ```
  It must report no errors. Warnings (for example about `operationId`, or the ambiguous itinerary paths that
  come from the PDF) are fine.
- Remove the `[Bonus]` endpoints you do not implement before the submission.

## Decisions Documented in the File

| Topic | Decision |
|---|---|
| Money | Flight and hotel prices, totals, payments and refunds are integers in cents of the platform currency (`25000` = 250.00 USD, PAY-04). Itinerary budget amounts are decimals in any currency (ITN-14). |
| Dates | `YYYY-MM-DD`. Flight times are entered as the airport's local time `YYYY-MM-DDTHH:mm` (FLT-03). |
| Date ranges | `from` and `to` are inclusive. For room availability they are the first and last night. |
| Flight booking flow | `POST /api/flight-bookings` returns the summary (FLT-19, FLT-21) without reserving anything; `POST /api/flight-bookings/hold` with the same body reserves the seats for 10 minutes (FLT-22). |
| Hotel booking flow | `POST /api/hotel-bookings` creates the reservation and holds all rooms for 10 minutes (HTL-16, HTL-18). |
| Then, for both | `GET /api/bookings/{type}/{id}/policies` → `POST .../accept-policies` → `POST /api/payments`. The Stripe webhook confirms the booking. |
| Refund before cancelling | Shown in the booking details (`GET /api/flight-bookings/{id}`, `GET /api/hotel-bookings/{id}`), FLT-26 and HTL-21. |
| Images | Airline logo and hotel photos are sent with the create/edit forms (`multipart/form-data`); activity and post images have their own endpoints (GEN-08). |
| Payments from Swagger | `paymentMethodId: pm_card_visa` (test mode) lets the backend confirm a payment without card data. |
| PDF corrections | `PUT /api/hotels/{id}/policies` is HTL-09 + HTL-10 (the PDF says HTL-08); `GET /api/itineraries/{id}/hotels` also covers ITN-25. |

## Requirements Without an Endpoint in the PDF Tables

These requirements need endpoints that PDF section 8 does not list ("Students may introduce additional
endpoints when justified"). Add them to `openapi.yaml` when they are designed:

| Requirement | Missing endpoint(s) |
|---|---|
| NEW-07 | Refresh the session, e.g. `POST /api/auth/refresh` |
| NEW-05, GEN-12, ACC-09 | Countries, cities, attractions and supported currencies lists |
| GEN-01 | Notifications: list, unread count, mark as read, mark all as read |
| GEN-09 | A user reports content, e.g. `POST /api/reports` |
| GEN-10 | An admin hides content directly (deleting already exists) |
| ACC-15 | An admin deactivates and reactivates a hotel or airline |
| BON-01, BON-02 (bonus) | Admin analytics; favourites |

## Shared Formats

Every error (schema `Error`):

```json
{
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": "Validation failed",
  "fieldErrors": [{ "field": "email", "messages": ["email must be an email"] }],
  "path": "/api/auth/register",
  "timestamp": "2026-10-21T19:05:34.294Z"
}
```

`fieldErrors` is present only for validation errors (GEN-02).

Every list (schema `PaginatedList`), 10 items per page, next page with `?page=2` (GEN-05):

```json
{ "items": [], "page": 1, "pageSize": 10, "total": 0, "totalPages": 0 }
```
