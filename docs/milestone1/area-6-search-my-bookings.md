3abeed Khaled 

# **Area 6: Search & My Bookings** 

### **Assigned to:** 

Milestone 1 task sheet · backend + Swagger 

**Your goal:** Everything around finding and listing bookings: flight search, flight details, the booking summary, "my bookings" lists, the moderators' flight manifest and hotel reservation list, and search from an itinerary. 

**Your folders:** `flights/flight-search.controller.ts, flights/ (details, manifest), flight-bookings/ (summary, lists), hotel-bookings/ (lists), hotels/ (reservations list)` 

12 12 8 REQUIREMENTS PDF ENDPOINTS TASKS 

## **1. Your requirements (GitHub issues)** 

|**Issue**|**Id**|**Requirement**|**Complexity**|
|---|---|---|---|
|#123|**FLT-11**|Search flights by selecting a departure airport, arrival airport…|**high**|
|#22|**FLT-12**|Support: (a) round-trip search returning outbound and return options…|**high**|
|#23|**FLT-15**|Filter flight results by an inclusive minimum and maximum price while…|**medium**|
|#24|**FLT-17**|A flight details page showing airline, flight number, airports, local…|**low**|
|#25|**FLT-19**|Allow a registered user, during booking, to enter each passenger's full…|**medium**|
|#26|**FLT-21**|A booking summary (flight, passengers, baggage, total) before payment|**low**|
|#29|**FLT-25**|View their flight bookings grouped as Upcoming, Past and Cancelled…|**low**|
|#31|**FLT-29**|View, per flight, its bookings (reference, passenger names, cabin…|**low**|
|#47|**HTL-20**|View their hotel reservations grouped as Upcoming, Past and Cancelled…|**low**|
|#49|**HTL-22**|View reservations for their hotel (guest, dates, status)|**low**|
|#68|**ITN-25**|Pick a city group in their itinerary and view hotels available for that…|**medium**|
|#69|**ITN-26**|Search one-way or round-trip flights from a chosen origin airport to…|**medium**|



## **2. Your endpoints** 

|**Method**|**Path**|**Requirements**|
|---|---|---|
|**`POST`**|`/api/flight-bookings`|FLT-19, FLT-21|
|**`GET`**|`/api/flight-bookings`|FLT-25|
|**`GET`**|`/api/flight-bookings/:id`|FLT-25|
|**`GET`**|`/api/flights/search`|FLT-11, FLT-12, FLT-15|
|**`GET`**|`/api/flights/:id`|FLT-17|
|**`GET`**|`/api/flights/:id/bookings`|FLT-29|
|**`GET`**|`/api/flights/:id/passengers/export`|FLT-29|
|**`GET`**|`/api/hotel-bookings`|HTL-20|
|**`GET`**|`/api/hotel-bookings/:id`|HTL-20|
|**`GET`**|`/api/hotels/:id/reservations`|HTL-22|
|**`GET`**|`/api/itineraries/:id/hotels`|ITN-09 (built for ITN-25)|
|**`GET`**|`/api/itineraries/:id/flights`|ITN-26|



3abeed Khaled 

## **3. Your tasks** 

- Flight search one-way and round-trip by route, dates, passenger types (adult / child / infant) and cabin (FLT-11, FLT12), with price filter and sorting (FLT-15). Export the search service. 

- Flight details with local airport times (FLT-17). 

- Booking summary (FLT-19, FLT-21): passengers, baggage and price breakdown, then hand off to Area 1's seat hold. My flight bookings (FLT-25) and my hotel reservations (HTL-20), grouped Upcoming / Past / Cancelled, with the refund preview from Area 1. 

- Moderator view of a flight's bookings and the passenger CSV export (FLT-29). 

- Hotel moderator's reservation list for their hotel, filtered and paginated (HTL-22). 

- From an itinerary: hotels for a city group using Area 7's hotel search (ITN-25) and flights using your flight search (ITN-26). 

- Rehearse demo scenarios 3 and 8 together with Area 1. 

## **4. Dependencies** 

|**Others**|**need from you**|
|---|---|
|**Who**|**What**|
|Area 1|Booking summary (passengers, baggage) that hands|
||off to the seat hold (FLT-19, FLT-21)|



|**You nee**|**d from others**|
|---|---|
|**From**|**What**|
|Area 3|Error format, ValidationPipe, pagination, shared<br>enums (GEN-02, GEN-05, GEN-13)|
|Area 2|User schema, login, cookies, JwtAuthGuard /|
||RolesGuard / @CurrentUser, ownership helper (ACC-<br>04, ACC-11, ACC-19)|
|Area 5|Seed data (countries, cities, airports with time zones,|
||attractions, supported currencies) + lookups (GEN-<br>12, FLT-02)|
|Area 7|Hotel schema (reviews and the reservation list<br>belong to a hotel) (HTL-01, HTL-22, HTL-24)|
|Area 5|Flight + cabin schemas, baggage allowance and the|
||local-time helper (search and flight details) (FLT-03,<br>FLT-04, FLT-08, GEN-06)|
|Area 1|Flight booking + hotel reservation schemas (admin<br>overview, my bookings, flight manifest, reservation<br>list) (GEN-11, ACC-17, FLT-29, HTL-22)|
|Area 8|Itinerary schema (days and city groups) (ITN-05, ITN-<br>09)|
|Area 7|Exported hotel search service (HTL-11, ITN-25)|
|Area 1|Refund preview in booking details (FLT-26, HTL-21)|



Until it is merged, code against the agreed interface (e.g. insert test documents directly in Atlas). 

## **Bonus (only after all your mandatory work is merged)** 

|#104|**FLT-27**|Change a Confirmed fli|ght booking's date or flight (same route and…|
|---|---|---|---|
|#105|**FLT-28**|Allow seat selection||





<!-- Start of picture text -->
5. Workflow for each requirement<br>Excel id → GitHub issue → git grep id → Branch → Schema · DTO · Service · Route → Test in Swagger →<br><!-- End of picture text -->

3abeed Khaled 

#### **PR → develop → Review & merge** 

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

- Works end to end in Swagger with the seeded data. 

- Validation and authorization in the backend (wrong input 400, not logged in 401, wrong role 403, another user's data 404). 

- Every rule and error case in the issue is handled with a clear message. 

- Lists are paginated (10 per page). 

- (3) Round-trip search with an adult, a child and an infant; hold; accept policies; pay; confirmed with a reference and e-ticket. 

- (8) Multi-room hotel booking; an overlapping request is rejected; a review after the stay. 

Rules every area follows in its own module: GEN-02 validation messages, GEN-04 empty lists, GEN-05 pagination (10 per page), GEN-11 booking lifecycle, GEN-13 backend enforces every rule. 

- Matches docs/api/openapi.yaml, or the file is updated in the same PR. 

- Merged into develop through a reviewed PR that says "Closes #<issue>". 

- AI_PROMPTS.txt updated if AI was used. 

Travel Planning & Booking Platform · Software Project I, Winter 2026 · Milestone 1 (Backend & Swagger) 

