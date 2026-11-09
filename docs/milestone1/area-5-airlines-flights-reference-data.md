3abeed Khaled 

# **Area 5: Airlines, Flights & Reference** 

# **Data** 

**Assigned to:** 

Milestone 1 task sheet · backend + Swagger 

**Your goal:** The official reference data every module relies on, airline profiles and policies, and flight inventory with cabins and seat counters that Area 1 holds seats on. 

**Your folders:** `database/ (seed), reference-data/, airlines/, flights/ (inventory), refund-tier rule in common/utils/` 

13 

REQUIREMENTS 

11 

PDF ENDPOINTS 

8 

TASKS 

## **1. Your requirements (GitHub issues)** 

|**Issue**|**Id**|**Requirement**|**Complexity**|
|---|---|---|---|
|#94|**GEN-12**|Reference data at setup: airports, cities, countries and supported…|**low**|
|#117|**NEW-05**|Shared reference data (countries, cities) with read endpoints and…|**low**|
|#15|**FLT-02**|A predefined, read-only list of airports (IATA code, name, city…|**low**|
|#14|**FLT-01**|Create an airline profile and an airline moderator to edit their…|**low**|
|#16|**FLT-03**|Create a flight with flight number, departure and arrival airports, and…|**medium**|
|#17|**FLT-04**|Define cabin categories per flight from the fixed set {Economy, Premium…|**medium**|
|#18|**FLT-05**|Edit departure/arrival times, cabin prices and cabin seat counts of…|**medium**|
|#19|**FLT-06**|Cancel a Scheduled flight after confirmation|**medium**|
|#20|**FLT-08**|Define a price per extra bag (>0) and a maximum number of extra bags…|**low**|
|#21|**FLT-09**|Define cancellation tiers, each with a unique days-before-departure…|**medium**|
|#91|**FLT-30**|Flights shall have a status of Scheduled, Cancelled or Departed|**low**|
|#85|**GEN-06**|Flight times in each airport's local time zone|**medium**|
|#115|**NEW-02**|Impact of flight changes/cancellation on existing bookings|**medium**|
|**. Your**<br>**Method**|**endpoint**<br><br>**Path**|**s**|**Requirements**|
|**`POST`**|`/api/air`|`lines`|FLT-01|
|**`GET`**|`/api/air`|`lines/:id`|FLT-01|
|**`PATCH`**|`/api/air`|`lines/:id`|FLT-01|
|**`PUT`**|`/api/air`|`lines/:id/baggage-policy`|FLT-04, FLT-08|
|**`PUT`**|`/api/air`|`lines/:id/cancellation-policy`|FLT-09|
|**`POST`**|`/api/fli`|`ghts`|FLT-03|
|**`PATCH`**|`/api/fli`|`ghts/:id`|FLT-05|
|**`POST`**|`/api/fli`|`ghts/:id/cancel`|FLT-06|
|**`POST`**<br>**`PATCH`**|`/api/fli`<br>`/api/fli`|`ghts/:id/cabins`<br>`ghts/:id/cabins/:cabinId`|FLT-04<br>FLT-04, FLT-05|



## **2. Your endpoints** 

3abeed Khaled 

```
GET
```

FLT-03, FLT-11 

```
/api/airports
```

**_`?`_** _An extra endpoint may be needed (not in the PDF tables) for: reading countries, cities, attractions and the supported currency list (NEW-05, GEN-12, ACC-09, ITN-18)_ 

## **3. Your tasks** 

Seed script (npm run seed): countries, cities, airports and attractions from the official datasets with the official ids (EG, cairo, CAI, att-1), an IANA time zone added to every airport (FLT-02), and the supported currencies (GEN-12). Running it twice creates no duplicates. 

Exported reference lookups so other modules reject unknown countries, cities and airports (NEW-05). 

- Airline schema + endpoints: admin creates, the airline's moderator edits; logo as multipart, 1 per airline (FLT-01). Extra-baggage rules (FLT-08) and cancellation tiers (FLT-09); the shared tier rule in common/utils/ for Area 1. 

- Flight schema with airports validated by the lookups, times stored in UTC and shown in each airport's local zone with luxon (FLT-03, GEN-06). 

- Cabins with prices and total / booked / held seat counters, so Area 1 can hold seats atomically (FLT-04). 

- Edit the schedule and notify affected bookings (FLT-05, NEW-02); cancel a flight: its bookings are cancelled with 100% refunds through Area 1 (FLT-06). 

- Flight status Scheduled / Cancelled / Departed, with a cron job that marks flights Departed (FLT-30). Rehearse demo scenarios 2 and 7. 

## **4. Dependencies** 

|**Others need fr**|**om you**|**You nee**|**d from others**|
|---|---|---|---|
|**Who**|**What**|**From**|**What**|
|Areas 2, 6, 7, 8|Seed data (countries, cities, airports with<br>time zones, attractions, supported|Area 3|Error format, ValidationPipe, pagination, shared<br>enums (GEN-02, GEN-05, GEN-13)|
||currencies) + lookups (GEN-12, NEW-05,<br>FLT-02)|Area 2|User schema, login, cookies, JwtAuthGuard /<br>RolesGuard / @CurrentUser, ownership helper (ACC-|
|Area 3|Seed script where the admin account is||04, ACC-11, ACC-19)|
||added (GEN-12, ACC-18)|Area 3|Admin creates the airline / hotel moderator (ACC-13)|
|Area 3|Airline schema (a moderator is linked to one<br>airline; airlines can be deactivated) (FLT-01,|Area 3|NotificationsService (GEN-01)|
||ACC-13, ACC-15)|Area 1|Flight booking schema (no airport change or seat|
|Area 1|Flight + cabin schemas with total / booked /<br>held seat counters and flight status (FLT-03,||cut below booked; notify affected bookings) (GEN-<br>11, FLT-05, NEW-02)|
||FLT-04, FLT-30)|Area 4|Image upload validation (GEN-08)|
|Area 6|Flight + cabin schemas, baggage allowance<br>and the local-time helper (search and flight<br>details) (FLT-03, FLT-04, FLT-08, GEN-06)|Area 1<br>Until it is|Refund function (airline cancels a flight: 100%<br>refunds) (PAY-03, FLT-06)<br>merged, code against the agreed interface (e.g. insert test|
|Area 1|Airline baggage + cancellation policies and<br>the shared tier rule (shown before payment,<br>used for refunds) (FLT-08, FLT-09, PAY-02)|documen|ts directly in Atlas).|



## **5. Workflow for each requirement** 

|**Excel id**<br>**→**<br> <br>**PR → develop**|**GitHub issue**<br>**→**<br>**git grep id**<br>**→**<br>**→**<br>**Review & merge**|**Branch**<br>|**→**<br>**Schema · DTO · Service · Route**<br>**→**|**Test in Swagger**<br>**→**|
|---|---|---|---|---|



- **1 Pick the requirement.** Take the next id from your list (respect "Dependencies"). Open its GitHub issue and read the requirement and the definition of done. 

3abeed Khaled 

- **2 Find where it goes.** Run `git grep FLT-11` : the controller comment shows the endpoint(s), the schema / DTO comments show what to model. openapi.yaml shows the exact request, response and status codes. 

- **3 Create a branch.** `git checkout develop` → `git pull` → `git checkout -b feature/FLT-11-flight-search` 

- **4 Build it.** Schema → DTO with class-validator rules → service with the business rules → controller route with guards and roles. 

- **5 Test in Swagger.** `npm run start:dev` , open localhost:3000/api/docs. Test the happy path AND every rule: bad input, no login, wrong role, other user's data, limits, concurrency. 

- **6 Commit and push.** `git commit -m "feat(flights): implement flight search (FLT-11)"` → `git push -u origin feature/FLT-11-flight-search` 

- **7 Open a PR to develop.** Fill in the template: requirement ids, "Closes #123", how to test in Swagger. Run lint, build and tests first. 

- **8 Review and merge.** The team leader reviews. Fix the comments, resolve the conversations; after approval it is merged and the issue closes. 

- **9 Log AI use.** If AI helped, add an entry to AI_PROMPTS.txt in the same PR. 

## **6. Done means** 

## **7. Demo scenarios to show** 

- Works end to end in Swagger with the seeded data. 

- Validation and authorization in the backend (wrong input 400, not logged in 401, wrong role 403, another user's data 404). 

- Every rule and error case in the issue is handled with a clear message. 

- Lists are paginated (10 per page). 

- (2) Admin creates an airline and its moderator; the moderator changes the temporary password and creates a flight with cabins. 

- (7) The airline cancels a flight: 100% refunds and notifications. 

Rules every area follows in its own module: GEN-02 validation messages, GEN-04 empty lists, GEN-05 pagination (10 per page), GEN-11 booking lifecycle, GEN-13 backend enforces every rule. 

- Matches docs/api/openapi.yaml, or the file is updated in the same PR. 

- Merged into develop through a reviewed PR that says "Closes #<issue>". 

- AI_PROMPTS.txt updated if AI was used. 

Travel Planning & Booking Platform · Software Project I, Winter 2026 · Milestone 1 (Backend & Swagger) 

