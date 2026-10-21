# Team Conventions

Read this before your first pull request.

## 1. Git Workflow

- `main` is for milestone releases only. Nobody pushes to it directly.
- `develop` is the integration branch. Changes go in through reviewed pull requests only.
- Create every branch from the latest `develop`:

```bash
git checkout develop
git pull origin develop
git checkout -b feature/FLT-11-flight-search
```

| Branch prefix | Use |
|---|---|
| `feature/<REQ-ID>-<short-description>` | New functionality |
| `fix/<REQ-ID>-<short-description>` | Bug fixes |
| `refactor/<short-description>` | Restructuring without behaviour change |
| `docs/<short-description>` | Documentation only |

- Keep branches small. Open a PR when one or two requirements are done, not at the end of the week.
- Merge `develop` into your branch at least every two days, and before opening a PR.
- Never commit `.env`, credentials, `node_modules/` or `uploads/`.

### Commit Messages (Conventional Commits)

```
feat(flights): add round-trip search (FLT-12)
fix(hotels): prevent overlapping holds (HTL-18)
refactor(payments): extract refund calculation
docs(api): document booking endpoints
test(itineraries): cover day reordering (ITN-08)
```

Scopes match module folder names. Never use messages like `update`, `changes`, `final` or `fix`.

### Pull Requests

- Target `develop`, and fill in the PR template (requirement IDs and how to test in Swagger).
- The team leader reviews and merges. Resolve review comments before merging.
- `npm run lint`, `npm run build` and `npm test` must pass.
- Add your `AI_PROMPTS.txt` entry in the same PR when AI helped with the work.

## 2. Backend Structure

```
backend/src/
├── main.ts            server start-up (/api prefix, Swagger)
├── app.module.ts      database connection and module registration
├── config/            environment validation
├── common/            shared code: enums, decorators, guards, filters, pipes, DTOs, utils
├── database/          seed script and the official reference datasets
└── <module>/          one folder per feature
    ├── <module>.module.ts
    ├── <module>.controller.ts   header comment: owner, requirements, endpoints
    ├── <module>.service.ts
    ├── dto/                     create-x.dto.ts, update-x.dto.ts, x-query.dto.ts
    └── schemas/                 x.schema.ts (placeholder files list what to model)
```

- Controllers stay thin: validate input with DTOs, read the current user, call the service.
- Business rules, ownership checks and database access go in services.
- Only add files inside your own module. Changes to `common/`, `main.ts`, `app.module.ts` or another member's module go in a separate small PR so everyone sees them.
- Every file currently contains placeholder comments only. Replace the `TODO` comments as you implement.

## 3. API Conventions

| Topic | Rule |
|---|---|
| Base path | Everything is under `/api` (set in `main.ts`; do not repeat it in `@Controller`). |
| Ids | Validate path ids (e.g. `ParseObjectIdPipe` from `@nestjs/mongoose`). |
| Validation | Every body and query is a DTO class with `class-validator` decorators. |
| Pagination | Lists use page size 10 (GEN-05) and the shared pagination types in `common/dto/`. |
| Errors | Throw Nest exceptions (`BadRequestException`, `NotFoundException`, `ConflictException`, ...) and use the shared error format from `common/filters/`. |
| Money | Store integer minor units (`12345` = 123.45) in the platform currency. Never use floats for money. |
| Dates | Store UTC dates. Show flight times in the airport's local time zone (GEN-06). |
| Swagger | Every route has `@ApiOperation({ summary: '... (REQ-ID)' })`; DTO fields have `@ApiProperty` with examples. |

### Status Codes

| Code | When |
|---|---|
| 200 / 201 / 204 | Success |
| 400 | Invalid input or a business-rule violation (e.g. min price > max price) |
| 401 | Not logged in / session expired |
| 403 | Logged in but not allowed (wrong role, suspended, another provider) |
| 404 | Not found, or another user's private resource (ACC-11) |
| 409 | Conflict: duplicate email, no seats/rooms left, overlapping hold |

## 4. Shared Code

Several modules depend on code that other members write. Agree on the function names and signatures early, then implement them.

| Shared code | Folder | Owner | Used by |
|---|---|---|---|
| Error format, validation pipe, pagination types, enums | `common/` | Member 1 | Everyone |
| Auth guard, roles guard, current-user decorator | `common/guards/`, `common/decorators/` | Member 2 | Everyone |
| Reference data (countries, cities, airports) and seed | `reference-data/`, `database/` | Member 1 | Members 4, 6, 8 |
| Notifications (GEN-01) | `notifications/` | Member 3 | Members 2, 4, 5, 7, 1 |
| Audit log (GEN-07) | `audit/` | Member 3 | Members 2, 3 |
| Image upload validation (GEN-08) | `uploads/` | Member 3 | Members 3, 4, 6, 8 |
| Cancellation-tier refund rule (FLT-09, HTL-10) | `common/utils/` | Member 4 | Members 5, 7 |
| Payments and refunds (PAY-01..03) | `payments/` | Member 1 | Members 5, 7 |

## 5. Schemas

- Use `@Schema({ timestamps: true })` unless there is a reason not to.
- Reference other collections by id (`Types.ObjectId` with `ref`). Embed bounded data that belongs to the parent (cabins inside a flight, passengers inside a booking).
- Reference data uses the official ids as `_id`: store `cityId: 'cairo'`, `airport: 'CAI'`, `countryCode: 'EG'`.
- Add indexes for fields you filter or sort on, and unique indexes for uniqueness rules (e.g. room number per hotel).
- Snapshot prices on bookings at booking time (FLT-05, HTL-05).
