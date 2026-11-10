3abeed Khaled 

# **Area 8: Itineraries & Exchange Rates** 

### **Assigned to:** 

Milestone 1 task sheet · backend + Swagger 

**Your goal:** Day-by-day itineraries with activities, images, budgets and transport costs, currency conversion through FXRatesAPI, and public search and cloning. 

**Your folders:** `itineraries/, exchange-rates/` 

|13<br>24<br>8|
|---|
|REQUIREMENTS<br>PDF ENDPOINTS<br>TASKS|



## **1. Your requirements (GitHub issues)** 

|**Issue**|**Id**|**Requirement**|**Complexity**|
|---|---|---|---|
|#55|**ITN-01**|Create an itinerary with a required title (max 100 characters), one or…|**low**|
|#56|**ITN-03**|List their itineraries (title, countries, start date, days and…|**low**|
|#57|**ITN-05**|Add days to their itinerary and edit each day's city (selected from the…|**medium**|
|#58|**ITN-07**|Delete a day after confirmation|**medium**|
|#59|**ITN-08**|Move a day to a new position, with days renumbered and dates and…|**medium**|
|#60|**ITN-09**|Each itinerary day to have a city and shall display consecutive days in…|**medium**|
|#61|**ITN-10**|Add, edit and delete activities for an itinerary day, including name…|**low**|
|#62|**ITN-12**|Attach images to and remove images from an activity under the shared…|**medium**|
|#63|**ITN-14**|Add, edit and delete non-negative budget entries for each day across…|**medium**|
|#64|**ITN-16**|Add, edit and delete a transport cost entry (mode, from-city, to-city…|**low**|
|#65|**ITN-18**|All itinerary budget amounts to the user's preferred currency (from the…|**medium**|
|#66|**ITN-20**|Set an itinerary's visibility to Public or Private|**low**|
|#67|**ITN-21**|Search public itineraries by keyword matching title, country or city…|**medium**|



## **2. Your endpoints** 

|**Method**|**Path**|**Requirements**|
|---|---|---|
|**`POST`**|`/api/itineraries`|ITN-01|
|**`GET`**|`/api/itineraries`|ITN-03|
|**`GET`**|`/api/itineraries/:id`|ITN-03|
|**`PATCH`**|`/api/itineraries/:id`|ITN-01, ITN-20|
|**`DELETE`**|`/api/itineraries/:id`|ITN-01|
|**`POST`**|`/api/itineraries/:id/days`|ITN-05|
|**`PATCH`**|`/api/itineraries/:id/days/:dayId`|ITN-05|
|**`DELETE`**|`/api/itineraries/:id/days/:dayId`|ITN-07|
|**`PATCH`**|`/api/itineraries/:id/days/reorder`|ITN-08|
|**`POST`**|`/api/itineraries/:id/days/:dayId/activities`|ITN-10|
|**`PATCH`**|`/api/activities/:id`|ITN-10|
|**`DELETE`**|`/api/activities/:id`|ITN-10|



3abeed Khaled 

|**`POST`**|`/api/activities/:id/images`|ITN-12, GEN-08|
|---|---|---|
|**`DELETE`**|`/api/activities/:id/images/:imageId`|ITN-12|
|**`POST`**|`/api/itineraries/:id/days/:dayId/budgets`|ITN-14|
|**`PATCH`**|`/api/budgets/:id`|ITN-14|
|**`DELETE`**|`/api/budgets/:id`|ITN-14|
|**`POST`**|`/api/itineraries/:id/transport-costs`|ITN-16|
|**`PATCH`**|`/api/transport-costs/:id`|ITN-16|
|**`DELETE`**|`/api/transport-costs/:id`|ITN-16|
|**`GET`**|`/api/itineraries/:id/budget-summary`|ITN-14, ITN-18|
|**`GET`**|`/api/itineraries/public/search`|ITN-20, ITN-21|
|**`GET`**|`/api/itineraries/public/:id`|ITN-21|
|**`POST`**|`/api/itineraries/:id/clone`|ITN-21|



## **3. Your tasks** 

- Itinerary schema: title, countries, start date, ordered days (date = start date + position), cities, activities, images, budget entries, transport costs, visibility, cloned-from attribution, hidden flag. 

- Create / list / view / edit / delete own itineraries with ownership checks (ITN-01, ITN-03). 

- Days: add and edit (ITN-05), delete (ITN-07), reorder (ITN-08); every change renumbers days, recomputes dates and city groups (ITN-09) and budgets. 

- Activities (ITN-10) with images under the shared upload rule (ITN-12). 

- Budget entries for food, accommodation, local transport and activities (ITN-14); intercity transport costs (ITN-16). Exchange rates (ITN-18): FXRatesAPI called by the backend only, cached once a day in MongoDB, last cached rates if the API fails, clear errors for invalid currencies; budget summary in the display currency. 

- Visibility public / private (ITN-20); public search, view and clone into a private copy that keeps attribution (ITN-21). Add FXRATES_API_KEY to env.validation.ts and .env.example. Rehearse demo scenario 9. 

## **4. Dependencies** 

|**Others n**|**eed from you**|**You nee**|**d from others**|
|---|---|---|---|
|**Who**|**What**|**From**|**What**|
|Area 6|Itinerary schema (days and city groups) (ITN-05, ITN-|Area 3|Error format, ValidationPipe, pagination, shared|
||09)||enums (GEN-02, GEN-05, GEN-13)|
|Area 3|Itinerary schema with a hidden flag (GEN-09, GEN-|Area 2|User schema, login, cookies, JwtAuthGuard /|
||10)||RolesGuard / @CurrentUser, ownership helper (ACC-|
||||04, ACC-11, ACC-19)|
|||Area 5|Seed data (countries, cities, airports with time zones,<br>attractions, supported currencies) + lookups (GEN-<br>12, FLT-02)|
|||Area 4|Image upload validation (GEN-08)|



Until it is merged, code against the agreed interface (e.g. insert test documents directly in Atlas). 

## **Bonus (only after all your mandatory work is merged)** 

#107 **ITN-27** Allow booked flights and hotels to be linked to itinerary days, feeding… 

3abeed Khaled 

#108 **ITN-28** Export or print an itinerary as PDF 

## **5. Workflow for each requirement** 

**Excel id → GitHub issue → git grep id → Branch → Schema · DTO · Service · Route → Test in Swagger → PR → develop → Review & merge** 

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

- (9) Itinerary: add, reorder and delete days; budget summary in another currency; publish; another user clones it. 

Rules every area follows in its own module: GEN-02 validation messages, GEN-04 empty lists, GEN-05 pagination (10 per page), GEN-11 booking lifecycle, GEN-13 backend enforces every rule. 

- Lists are paginated (10 per page). 

- Matches docs/api/openapi.yaml, or the file is updated in the same PR. 

- Merged into develop through a reviewed PR that says "Closes #<issue>". 

- AI_PROMPTS.txt updated if AI was used. 

Travel Planning & Booking Platform · Software Project I, Winter 2026 · Milestone 1 (Backend & Swagger) 

