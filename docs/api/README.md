# API Documentation

Swagger UI is the live API reference: run the backend and open http://localhost:3000/api/docs.
The raw OpenAPI document is at http://localhost:3000/api/docs-json.

The list of endpoints to implement, with their requirement IDs, is in the header comment of each controller
(`backend/src/<module>/<module>.controller.ts`). It follows section 8 of the project description, plus the
additions in [ASSUMED_REQUIREMENTS.md](../requirements/ASSUMED_REQUIREMENTS.md).

## Agreed Error Format

The shared exception filter (`common/filters/`, to be implemented) should give every error response the same shape:

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

## Agreed Paginated List Format

```json
{ "items": [], "page": 1, "pageSize": 10, "total": 0, "totalPages": 0 }
```

Request a page with `?page=2` (GEN-05).
