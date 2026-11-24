# API Documentation

All Swagger documentation is in one file: [openapi.yaml](openapi.yaml) (OpenAPI 3.0). The backend loads it
in `main.ts`, and Swagger UI shows it at http://localhost:3000/api/docs (raw JSON at `/api/docs-json`).

It documents every endpoint of PDF section 8, grouped and ordered like the PDF tables, with:
the requirement IDs in each summary, who may call it, the rules from the requirements workbook, the parameters,
the request body fields with examples, and the possible responses. Optional endpoints are marked `[Bonus]`.

All 119 endpoints of PDF section 8 (110 mandatory + 9 optional) are implemented, plus the extra endpoints listed
below; every route in the code is documented here.

## Working With the File

- **Implement an endpoint exactly as documented**: same method, path, field names, status codes.
- **Changing or adding an endpoint?** Update `openapi.yaml` in the same pull request. Copy a similar endpoint
  as a template, and put the requirement IDs at the end of the summary.
- Endpoints that need login have `security: *auth`; public endpoints have `security: []`.
- Every operation has an `operationId` (method + path, e.g. `postPaymentsByIdRetry`). Give new endpoints one
  in the same style.
- **Error responses:** write the schema and an `example` with the real status code and message, so Swagger
  shows the right error under each code (copy any existing error response):
  ```yaml
        '409':
          description: The email is already registered.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              example: {"statusCode": 409, "error": "CONFLICT", "message": "An account with this email already exists", "path": "/api/auth/register", "timestamp": "2026-11-01T10:00:00.000Z"}
  ```
  For a common 401 or validation 400, use `$ref: '#/components/responses/Unauthorized'` or
  `$ref: '#/components/responses/ValidationError'`. Do not use `content: *error` alone: Swagger would show a
  400 example under every code.
- **Success responses of implemented endpoints:** add a schema (`components/schemas`) with the exact field names
  the code returns, as for payments, refunds and bookings.
- The server reads the file when it starts. After editing it, restart `npm run start:dev` to see the change.
- Check the file before committing:
  ```bash
  npx @redocly/cli lint docs/api/openapi.yaml
  ```
  It must report no errors. The remaining warnings are fine: the ambiguous paths that come from the PDF
  (for example `/api/flights/search` and `/api/flights/{id}`) and `/api/health`, which has no error response.
- All `[Bonus]` endpoints are implemented; keep the label so the evaluators can tell them apart.

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

## Extra Endpoints (not in the PDF Tables)

PDF section 8 allows extra endpoints when justified (8.10: "These services may expose additional REST endpoints
as needed"). These are the ones the backend adds, all documented in `openapi.yaml`:

| Endpoint | Requirement |
|---|---|
| `POST /api/auth/refresh` | ACC-06, ACC-19: rotate the refresh token, keep the session alive |
| `GET /api/countries`, `GET /api/cities`, `GET /api/attractions`, `GET /api/currencies` | GEN-12, ACC-09, ITN-01, ITN-05: the seeded reference data |
| `GET /api/notifications`, `GET /api/notifications/unread-count`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all` | GEN-01 |
| `POST /api/reports` | GEN-09: a user reports content |
| `PATCH /api/admin/content/:type/:id/hide`, `PATCH /api/admin/content/:type/:id/unhide` | GEN-10: an admin hides content directly |
| `GET /api/airlines/:id/flights` | FLT-03, FLT-05: the airline moderator's own flights (airline dashboard) |
| `GET /api/hotels/:id/rooms` | HTL-03, HTL-06: the hotel moderator's own rooms (hotel dashboard) |
| `GET /api/admin/providers` | ACC-13, ACC-15: airlines or hotels with their moderators (admin providers table) |
| `GET /api/admin/analytics` | BON-01 (bonus) |
| `POST /api/favourites`, `GET /api/favourites`, `DELETE /api/favourites/:id` | BON-02 (bonus) |
| `GET /api/health` | Not a requirement: health check |

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
