3abeed Khaled 

# **Area 2: Auth & Sessions** 

### **Assigned to:** 

Milestone 1 task sheet · backend + Swagger 

**Your goal:** Registration, login with secure cookies, sessions, roles and ownership checks for the whole team, the user profile and account self-service. 

**Your folders:** `auth/, users/, common/guards/, common/decorators/` 

12 9 8 REQUIREMENTS PDF ENDPOINTS TASKS 

## **1. Your requirements (GitHub issues)** 

|**Issue**|**Id**|**Requirement**|**Complexity**|
|---|---|---|---|
|#1|**ACC-01**|Register by entering name, unique email, password and a mandatory…|**low**|
|#120|**ACC-04**|Allow a registered user, admin or moderator to log in with email and…|**medium**|
|#2|**ACC-05**|After 5 consecutive failed login attempts, the system shall lock the…|**medium**|
|#3|**ACC-06**|Log out, which clears the authentication cookies and revokes the…|**medium**|
|#4|**ACC-07a**|Reset a user's or moderator's password to a temporary password|**low**|
|#5|**ACC-08**|Change their password by entering the current password and a new one…|**low**|
|#6|**ACC-09**|Edit name, phone number and preferred currency, saving only if all…|**low**|
|#8|**ACC-11**|Access to bookings and private itineraries to their owner, except that…|**medium**|
|#121|**ACC-12**|Deactivate their own account after confirmation|**medium**|
|#96|**ACC-19**|Never store authentication tokens or user credentials in localStorage…|**medium**|



## **2. Your endpoints** 

|**Method**|**Path**<br>|**Requirements**|
|---|---|---|
|**`POST`**|`/api/admin/users/:id/reset-password`<br>|ACC-07a|
|**`POST`**|`/api/auth/register`<br>|ACC-01|
|**`POST`**|`/api/auth/login`<br>|ACC-04, ACC-05|
|**`POST`**|`/api/auth/logout`<br>|ACC-06|
|**`PATCH`**|`/api/auth/change-password`<br>|ACC-08|
|**`GET`**|`/api/auth/me`<br>|ACC-04, ACC-11|
|**`GET`**|`/api/users/me`<br>|ACC-11|
|**`PATCH`**|`/api/users/me`<br>|ACC-09|
|**`DELETE`**|`/api/users/me`<br>|ACC-12|
|**_`?`_**|_An extra endpoint may be needed (not in the PDF tables) for: refreshing the session (ACC-19)_||



3abeed Khaled 

## **3. Your tasks** 

- User schema: name, unique lowercase email, bcrypt password hash, role, status (active / suspended / deactivated), preferred currency, failedLoginAttempts + lockUntil, assigned airline or hotel for moderators. 

- Register (ACC-01): password rules, new account = Registered User + Active; admins can never self-register. 

- Login / logout / session refresh (ACC-04, ACC-06, ACC-19): 15-minute access JWT + rotating, hashed refresh token in httpOnly, Secure, SameSite cookies only (ACC-19); 30-minute idle expiry; logout revokes the session. 

- Lockout after 5 failed logins for 15 minutes; a successful login resets the counter (ACC-05). 

- Guards for the whole team: JwtAuthGuard, RolesGuard + @Roles(), @CurrentUser(), and an ownership helper: users only see their own data, moderators only their provider (ACC-11). Suspended accounts are rejected on every request. 

- Profile: GET / PATCH /api/users/me with validation of every field (ACC-09); change password with the current one (ACC-08). 

- Deactivate own account after confirmation, revoking all sessions (ACC-12); admin resets a password to a temporary one that must be changed at next login (ACC-07a). 

- Rehearse demo scenario 1 and test every guard: 401 without login, 403 with the wrong role, 404 for another user's data. 

## **4. Dependencies** 

|**Others nee**|**d from you**|**You nee**|**d from others**|
|---|---|---|---|
|**Who**|**What**|**From**|**What**|
|Every area|User schema, login, cookies, JwtAuthGuard /|Area 3|Error format, ValidationPipe, pagination, shared|
||RolesGuard / @CurrentUser, ownership helper||enums (GEN-02, GEN-05, GEN-13)|
||(ACC-04, ACC-11, ACC-19)|Area 5|Seed data (countries, cities, airports with time zones,|
|Area 3|Session revocation (used when an account is||attractions, supported currencies) + lookups (GEN-|
||suspended) (ACC-19, ACC-15)||12, FLT-02)|
|||Until it is<br>documen|merged, code against the agreed interface (e.g. insert test<br>ts directly in Atlas).|



## **Bonus (only after all your mandatory work is merged)** 

|#101|**ACC-02**|A verification link by email after registration and block booking until…|
|---|---|---|
|#102|**ACC-07**|Request a reset link by email; the link expires after 30 minutes, is…|



## **5. Workflow for each requirement** 



<!-- Start of picture text -->
Excel id → GitHub issue → git grep id → Branch → Schema · DTO · Service · Route → Test in Swagger →<br>PR → develop → Review & merge<br><!-- End of picture text -->

- **1 Pick the requirement.** Take the next id from your list (respect "Dependencies"). Open its GitHub issue and read the requirement and the definition of done. 

- **2 Find where it goes.** Run `git grep FLT-11` : the controller comment shows the endpoint(s), the schema / DTO comments show what to model. openapi.yaml shows the exact request, response and status codes. 

- **3 Create a branch.** `git checkout develop` → `git pull` → `git checkout -b feature/FLT-11-flight-search` 

- **4 Build it.** Schema → DTO with class-validator rules → service with the business rules → controller route with guards and roles. 

- **5 Test in Swagger.** `npm run start:dev` , open localhost:3000/api/docs. Test the happy path AND every rule: bad input, no login, wrong role, other user's data, limits, concurrency. 

3abeed Khaled 

- **6 Commit and push.** `git commit -m "feat(flights): implement flight search (FLT-11)"` → `git push -u origin feature/FLT-11-flight-search` 

- **7 Open a PR to develop.** Fill in the template: requirement ids, "Closes #123", how to test in Swagger. Run lint, build and tests first. 

- **8 Review and merge.** The team leader reviews. Fix the comments, resolve the conversations; after approval it is merged and the issue closes. 

- **9 Log AI use.** If AI helped, add an entry to AI_PROMPTS.txt in the same PR. 

## **6. Done means** 

## **7. Demo scenarios to show** 

Works end to end in Swagger with the seeded data. 

- Validation and authorization in the backend (wrong input 400, not logged in 401, wrong role 403, another user's data 404). 

- Every rule and error case in the issue is handled with a clear message. 

- (1) Register; log in; trigger the lockout after 5 wrong passwords. 

Rules every area follows in its own module: GEN-02 validation messages, GEN-04 empty lists, GEN-05 pagination (10 per page), GEN-11 booking lifecycle, GEN-13 backend enforces every rule. 

- Lists are paginated (10 per page). 

- Matches docs/api/openapi.yaml, or the file is updated 

- in the same PR. 

- Merged into develop through a reviewed PR that says 

- "Closes #<issue>". 

- AI_PROMPTS.txt updated if AI was used. 

Travel Planning & Booking Platform · Software Project I, Winter 2026 · Milestone 1 (Backend & Swagger) 

