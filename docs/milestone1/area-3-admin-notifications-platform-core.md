3abeed Khaled 

# **Area 3: Admin, Notifications & Platform Core** 

**Assigned to:** 

Milestone 1 task sheet · backend + Swagger 

**Your goal:** The shared base every module stands on (validation, error format, pagination) and all admin work: moderator accounts, suspensions, the bookings overview, content reports, moderation, the audit log and the inapp notification service. 

**Your folders:** `main.ts, app.module.ts, common/ (filters, pipes, pagination, enums), config/, admin/, reports/, audit/, notifications/` 

|14|
|---|



REQUIREMENTS 

9 PDF ENDPOINTS 

8 

TASKS 

## **1. Your requirements (GitHub issues)** 

|**Issue**|**Id**|**Requirement**|**Complexity**|
|---|---|---|---|
|#81|**GEN-02**|Field-level validation messages on all forms|**low**|
|#83|**GEN-04**|Friendly empty states when a list or search has no results|**low**|
|#84|**GEN-05**|Paginate every list longer than 10 rows (page size 10)|**low**|
|#95|**GEN-13**|All validation, business rules and authorisation shall be enforced by…|**medium**|
|#92|**ACC-18**|Admin accounts shall be created by seeding at setup; there is no admin…|**low**|
|#9|**ACC-13**|Create a hotel or airline moderator account (name, email, role) linked…|**medium**|
|#10|**ACC-14**|View a paginated list of all accounts (name, email, role, status…|**low**|
|#11|**ACC-15**|Suspend and reactivate a moderator account (a suspended moderator…|**medium**|
|#12|**ACC-16**|Suspend and reactivate registered users (for example, for abusive…|**low**|
|#13|**ACC-17**|View a read-only list of all flight and hotel bookings (reference…|**low**|
|#86|**GEN-07**|An audit log of admin actions (suspensions, deletions)|**low**|
|#88|**GEN-09**|Report a post, comment, review or itinerary with a reason, at most once…|**low**|
|#89|**GEN-10**|View the list of open reports and resolve each by dismissing it, hiding…|**medium**|
|#80|**GEN-01**|In-app notifications (unread count, notification list, mark as read)…|**medium**|



## **2. Your endpoints** 

|**Method**|**Path**|**Requirements**|
|---|---|---|
|**`POST`**|`/api/admin/moderators`|ACC-13|
|**`GET`**|`/api/admin/accounts`|ACC-14|
|**`PATCH`**|`/api/admin/accounts/:id/suspend`|ACC-15, ACC-16|
|**`PATCH`**|`/api/admin/accounts/:id/reactivate`|ACC-15, ACC-16|
|**`GET`**|`/api/admin/bookings`|ACC-17|
|**`GET`**|`/api/admin/audit-logs`|GEN-07|
|**`GET`**|`/api/admin/reports`|GEN-09, GEN-10|
|**`PATCH`**|`/api/admin/reports/:id`|GEN-10|



3abeed Khaled 

|**`DELETE`**|`/api/admin/content/:type/:id`<br>GEN-10|
|---|---|
|**_`?`_**|_An extra endpoint may be needed (not in the PDF tables) for: the notification list, unread count and mark as read (GEN-_<br>_01)_|
|**_`?`_**|_An extra endpoint may be needed (not in the PDF tables) for: deactivating / reactivating a hotel or airline (ACC-15)_|
|**_`?`_**|_An extra endpoint may be needed (not in the PDF tables) for: a registered user reporting content (GEN-09)_|
|**_`?`_**|_An extra endpoint may be needed (not in the PDF tables) for: the admin hiding content directly (GEN-10)_|



## **3. Your tasks** 

- main.ts / app.module.ts: cookie-parser, CORS, ScheduleModule.forRoot(), raw body for the payment webhook, static /uploads. 

- Global ValidationPipe with field-level errors (GEN-02) and a global exception filter using the error format in docs/api/README.md, so every rule is enforced by the backend with clear errors (GEN-13). 

- common/: pagination query DTO + helper returning {items, page, pageSize, total, totalPages}, page size 10 (GEN05); empty lists return items: [] (GEN-04); shared enums; env.validation.ts kept in sync with .env.example. 

- NotificationsService (exported) + the current user's notification list, unread count and mark as read (GEN-01). Seed the admin account (ACC-18) with Area 5. Moderators (ACC-13): admin creates a hotel or airline moderator with a temporary password, linked to exactly one provider. Accounts list with filters and pagination (ACC-14). 

- Suspend / reactivate users and moderators, revoking their sessions (ACC-15, ACC-16); deactivate / reactivate a hotel or airline (ACC-15). Admin bookings overview, read-only (ACC-17). 

- Reports: a user reports a post, comment, review or itinerary at most once (GEN-09); admin lists, dismisses, hides or deletes (GEN-10). Agree the "hidden" flag with Areas 4 and 8. 

- AuditService (exported) + GET /api/admin/audit-logs (GEN-07); every admin action writes an entry. Rehearse demo scenario 10. 

## **4. Dependencies** 

|**Others nee**|**d from you**|**You nee**|**d from others**|
|---|---|---|---|
|**Who**|**What**|**From**|**What**|
|Every area|Error format, ValidationPipe, pagination, shared|Area 2|User schema, login, cookies, JwtAuthGuard /|
||enums (GEN-02, GEN-05, GEN-13)||RolesGuard / @CurrentUser, ownership helper (ACC-|
|Area 1|Raw request body for the Stripe webhook<br>(main.ts) (PAY-01)|Area 5|04, ACC-11, ACC-19)<br>Seed script where the admin account is added (GEN-|
|Areas 5, 7|Admin creates the airline / hotel moderator||12, ACC-18)|
|Areas 1, 5|(ACC-13)<br>NotificationsService (GEN-01)|Area 5|Airline schema (a moderator is linked to one airline;<br>airlines can be deactivated) (FLT-01, ACC-13, ACC-<br>15)|
|||Area 7|Hotel schema (a moderator is linked to one hotel;<br>hotels can be deactivated) (HTL-01, ACC-13, ACC-15)|
|||Area 2|Session revocation (used when an account is<br>suspended) (ACC-19, ACC-15)|
|||Area 1|Flight booking + hotel reservation schemas (admin<br>overview, my bookings, flight manifest, reservation<br>list) (GEN-11, ACC-17, FLT-29, HTL-22)|
|||Area 4<br>Area 8|Post, comment and review schemas with a hidden<br>flag (GEN-09, GEN-10)<br>Itinerary schema with a hidden flag (GEN-09, GEN-<br>10)|



3abeed Khaled 

Until it is merged, code against the agreed interface (e.g. insert test documents directly in Atlas). 

## **Bonus (only after all your mandatory work is merged)** 

|#110|**BON-01**<br>An admin analytics dashboard showing bookings and revenue per provider…|
|---|---|
|#103|**GEN-01-B**<br>Send the GEN-01 notifications (plus moderator invitations) by email via…|



## **5. Workflow for each requirement** 

|**Excel id**<br>**→**<br> <br>**PR → develop**|**GitHub issue**<br>**→**<br>**git grep id**<br>**→**<br>**→**<br>**Review & merge**|**Branch**<br>|**→**<br>**Schema · DTO · Service ·**|**Route**<br>**→**|**Test in Swagger**<br>**→**|
|---|---|---|---|---|---|



- **1 Pick the requirement.** Take the next id from your list (respect "Dependencies"). Open its GitHub issue and read the requirement and the definition of done. 

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

- Works end to end in Swagger with the seeded data. Validation and authorization in the backend (wrong input 400, not logged in 401, wrong role 403, another user's data 404). 

- Every rule and error case in the issue is handled with a clear message. 

- (10) A post is reported, and the admin hides it; the audit log shows the action. 

Rules every area follows in its own module: GEN-02 validation messages, GEN-04 empty lists, GEN-05 pagination (10 per page), GEN-11 booking lifecycle, GEN-13 backend enforces every rule. 

- Lists are paginated (10 per page). 

- Matches docs/api/openapi.yaml, or the file is updated in the same PR. 

- Merged into develop through a reviewed PR that says 

- "Closes #<issue>". 

- AI_PROMPTS.txt updated if AI was used. 

Travel Planning & Booking Platform · Software Project I, Winter 2026 · Milestone 1 (Backend & Swagger) 

