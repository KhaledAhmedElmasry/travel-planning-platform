3abeed Khaled 

# **Area 7: Hotels & Rooms** 

### **Assigned to:** 

Milestone 1 task sheet · backend + Swagger 

**Your goal:** Hotel profiles and photos, individually bookable rooms, availability and blocked dates, policies, and hotel search. Area 1 books rooms on top of your schemas. 

**Your folders:** `hotels/` 

12 12 REQUIREMENTS PDF ENDPOINTS 

8 

TASKS 

## **1. Your requirements (GitHub issues)** 

|**Issue**|**Id**|**Requirement**|**Complexity**|
|---|---|---|---|
|#32|**HTL-01**|Create a hotel profile and a hotel moderator to edit their hotel's…|**low**|
|#33|**HTL-02**|A hotel details page showing the hotel profile, photos, amenities…|**low**|
|#34|**HTL-03**|Add a room (an individually bookable unit) with a room number/name…|**low**|
|#35|**HTL-04**|Define non-overlapping date ranges when a room is bookable|**medium**|
|#36|**HTL-05**|Edit a room's beds, occupancy, price and availability|**medium**|
|#37|**HTL-06**|Block date ranges for a room and to deactivate or delete a room|**medium**|
|#38|**HTL-08**|View each room's status for a chosen date range as Available, Booked…|**medium**|
|#39|**HTL-09**|Set the hotel's standard check-in and check-out times, shown on the…|**low**|
|#40|**HTL-10**|Define cancellation tiers, each with a unique days-before-check-in…|**medium**|
|#41|**HTL-11**|Search hotels by city or country, check-in date, check-out date, number…|**high**|
|#42|**HTL-12**|Filter hotel results by an inclusive minimum and maximum price per…|**medium**|
|#43|**HTL-15**|View all of a hotel's rooms that are free for the searched dates…|**medium**|



## **2. Your endpoints** 

|**Method**|**Path**|**Requirements**|
|---|---|---|
|**`POST`**|`/api/hotels`|HTL-01|
|**`GET`**|`/api/hotels/search`|HTL-11, HTL-12|
|**`GET`**|`/api/hotels/:id`|HTL-02|
|**`PATCH`**|`/api/hotels/:id`|HTL-01|
|**`POST`**|`/api/hotels/:id/rooms`|HTL-03|
|**`PATCH`**|`/api/hotels/:id/rooms/:roomId`|HTL-05|
|**`DELETE`**|`/api/hotels/:id/rooms/:roomId`|HTL-06|
|**`GET`**|`/api/hotels/:id/rooms/available`|HTL-15|
|**`POST`**|`/api/hotels/:id/rooms/:roomId/availability`|HTL-04|
|**`PATCH`**|`/api/hotels/:id/rooms/:roomId/availability`|HTL-05, HTL-06|
|**`GET`**|`/api/hotels/:id/availability`|HTL-08|
|**`PUT`**|`/api/hotels/:id/policies`|HTL-08, HTL-10|



3abeed Khaled 

## **3. Your tasks** 

- Hotel schema + endpoints: admin creates, only the hotel's moderator edits; city / country validated with the lookups; photos as multipart, max 5 (HTL-01). 

- Hotel details with photos, amenities, policies and rooms (HTL-02). 

- Rooms: add (HTL-03), edit (HTL-05), deactivate with active: false or delete only if never reserved (HTL-06). 

- Availability ranges (HTL-04) and blocked dates (HTL-06) per room; room status calendar for a date range (HTL-08). Policies: check-in / check-out times (HTL-09) and cancellation tiers (HTL-10) through PUT /api/hotels/:id/policies. 

- Hotel search by destination, dates and guests (HTL-11) with price filter and sorting (HTL-12). Export the search service. 

- Free rooms for the searched dates (HTL-15). 

- Room + availability schemas ready for Area 1's booking and hold. Rehearse demo scenario 8 with Area 1. 

## **4. Dependencies** 

|**Others nee**|**d from you**|**You nee**|**d from others**|
|---|---|---|---|
|**Who**|**What**|**From**|**What**|
|Area 3|Hotel schema (a moderator is linked to one hotel;<br>hotels can be deactivated) (HTL-01, ACC-13, ACC-|Area 3|Error format, ValidationPipe, pagination, shared<br>enums (GEN-02, GEN-05, GEN-13)|
||15)|Area 2|User schema, login, cookies, JwtAuthGuard /|
|Areas 4, 6|Hotel schema (reviews and the reservation list||RolesGuard / @CurrentUser, ownership helper (ACC-|
||belong to a hotel) (HTL-01, HTL-22, HTL-24)||04, ACC-11, ACC-19)|
|Area 1|Room + availability schemas (HTL-03, HTL-04,|Area 5|Seed data (countries, cities, airports with time zones,|
||HTL-06)||attractions, supported currencies) + lookups (GEN-|
|Area 1|Hotel check-in / check-out times + cancellation||12, FLT-02)|
||tiers (shown before payment, used for refunds)|Area 3|Admin creates the airline / hotel moderator (ACC-13)|
||(HTL-09, HTL-10, PAY-02)|Area 1|Reservation + hold data (Booked in the room|
|Area 6|Exported hotel search service (HTL-11, ITN-25)|Area 4|calendar, free rooms and search; no blocking over<br>reservations) (HTL-18, HTL-06, HTL-08, HTL-11, HTL-<br>15)<br>Image upload validation (GEN-08)|



Until it is merged, code against the agreed interface (e.g. insert test documents directly in Atlas). 

## **Bonus (only after all your mandatory work is merged)** 

#111 **BON-02** Save hotels and public itineraries to a favourites list and view it 

## **5. Workflow for each requirement** 



<!-- Start of picture text -->
Excel id → GitHub issue → git grep id → Branch → Schema · DTO · Service · Route → Test in Swagger →<br>PR → develop → Review & merge<br><!-- End of picture text -->

- **1 Pick the requirement.** Take the next id from your list (respect "Dependencies"). Open its GitHub issue and read the requirement and the definition of done. 

- **2 Find where it goes.** Run `git grep FLT-11` : the controller comment shows the endpoint(s), the schema / DTO comments show what to model. openapi.yaml shows the exact request, response and status codes. 

- **3 Create a branch.** `git checkout develop` → `git pull` → `git checkout -b feature/FLT-11-flight-search` 

- **4 Build it.** Schema → DTO with class-validator rules → service with the business rules → controller route with guards and roles. 

3abeed Khaled 

- **5 Test in Swagger.** `npm run start:dev` , open localhost:3000/api/docs. Test the happy path AND every rule: bad input, no login, wrong role, other user's data, limits, concurrency. 

- **6 Commit and push.** `git commit -m "feat(flights): implement flight search (FLT-11)"` → `git push -u origin feature/FLT-11-flight-search` 

- **7 Open a PR to develop.** Fill in the template: requirement ids, "Closes #123", how to test in Swagger. Run lint, build and tests first. 

- **8 Review and merge.** The team leader reviews. Fix the comments, resolve the conversations; after approval it is merged and the issue closes. 

- **9 Log AI use.** If AI helped, add an entry to AI_PROMPTS.txt in the same PR. 

## **6. Done means** 

## **7. Demo scenarios to show** 

Works end to end in Swagger with the seeded data. 

- Validation and authorization in the backend (wrong input 400, not logged in 401, wrong role 403, another user's data 404). 

- Every rule and error case in the issue is handled with a clear message. 

- (8) Multi-room hotel booking; an overlapping request is rejected; a review after the stay. 

Rules every area follows in its own module: GEN-02 validation messages, GEN-04 empty lists, GEN-05 pagination (10 per page), GEN-11 booking lifecycle, GEN-13 backend enforces every rule. 

- Lists are paginated (10 per page). 

- Matches docs/api/openapi.yaml, or the file is updated in the same PR. 

- Merged into develop through a reviewed PR that says 

- "Closes #<issue>". 

- AI_PROMPTS.txt updated if AI was used. 

Travel Planning & Booking Platform · Software Project I, Winter 2026 · Milestone 1 (Backend & Swagger) 

