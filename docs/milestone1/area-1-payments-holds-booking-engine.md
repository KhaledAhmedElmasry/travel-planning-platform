3abeed Khaled 

# **Area 1: Payments, Holds & Booking Core · hardest area Engine** 

### **Assigned to:** 

Milestone 1 task sheet · backend + Swagger 

**Your goal:** The hardest and most critical part of the platform: concurrency-safe seat and room holds, Stripe payments verified by webhook, booking confirmation, cancellations with policy-based refunds, and the automation that expires holds and completes bookings. Every booking demo depends on this area. 

**Your folders:** `payments/, flight-bookings/ (hold, confirm, cancel, e-ticket), hotel-bookings/ (booking, hold, confirm, cancel), booking cron jobs` 

|14|
|---|



REQUIREMENTS 

12 10 PDF ENDPOINTS TASKS 

## **1. Your requirements (GitHub issues)** 

|**Issue**|**Id**|**Requirement**|**Complexity**|
|---|---|---|---|
|#52|**PAY-01**|Pay for a Pending Payment flight booking or hotel reservation within…|**high**|
|#53|**PAY-02**|Before payment, the system shall show the provider's policies (airline…|**low**|
|#54|**PAY-03**|For every cancellation with a positive refund amount (user…|**medium**|
|#93|**PAY-04**|All flight and hotel prices, payments and refunds shall use a single…|**low**|
|#116|**NEW-04**|Booking amounts stay in the platform currency; only itinerary budgets…|**low**|
|#27|**FLT-22**|When a user proceeds to payment, the system shall atomically reserve…|**high**|
|#44|**HTL-16**|Book one or more available rooms in the same hotel for the same dates…|**high**|
|#46|**HTL-18**|When a user proceeds to payment, the system shall hold all selected…|**high**|
|#28|**FLT-23**|After successful payment, the system shall set the flight booking to…|**medium**|
|#45|**HTL-17**|After successful payment, the system shall set the reservation (all its…|**medium**|
|#30|**FLT-26**|Cancel their own Confirmed flight booking any time before departure…|**medium**|
|#48|**HTL-21**|Cancel their own Confirmed reservation as a whole before the check-in…|**medium**|
|#90|**GEN-11**|Flight bookings and hotel reservations shall follow the lifecycle…|**medium**|
|#114|**NEW-01**|Booking status automation: expire holds, mark stays/flights Completed|**medium**|



## **2. Your endpoints** 

|**Method**|**Path**|**Requirements**|
|---|---|---|
|**`POST`**|`/api/flight-bookings/hold`|FLT-22|
|**`POST`**|`/api/flight-bookings/:id/cancel`|FLT-26|
|**`GET`**|`/api/flight-bookings/:id/e-ticket`|FLT-23|
|**`POST`**|`/api/hotel-bookings`|HTL-16, HTL-18|
|**`POST`**|`/api/hotel-bookings/:id/cancel`|HTL-21|
|**`GET`**|`/api/bookings/:type/:id/policies`|PAY-02|
|**`POST`**|`/api/bookings/:type/:id/accept-policies`|PAY-02|
|**`POST`**|`/api/payments`|PAY-01|



3abeed Khaled 

|**`POST`**|`/api/payments/:id/retry`|PAY-01|
|---|---|---|
|**`GET`**|`/api/payments/:id`|PAY-01|
|**`POST`**|`/api/payments/webhook`|PAY-01|
|**`GET`**|`/api/refunds/:id`|PAY-03|



## **3. Your tasks** 

- Stripe in test mode: PaymentsService creates a PaymentIntent for a Pending Payment flight booking or hotel reservation. All amounts are integer cents of the platform currency USD (PAY-01, PAY-04, NEW-04). Never store card data. 

- Policies before payment: show the airline or hotel policies for a booking and store the acceptance with a timestamp; refuse payment without it (PAY-02). 

- Webhook: raw request body + Stripe signature verification. Only a verified successful payment confirms a booking; failed or expired payments leave it unconfirmed. Retry endpoint (PAY-01). 

- Flight seat hold (FLT-22): ONE atomic findOneAndUpdate on the cabin that increments held only if total - booked - held >= n. holdExpiresAt = now + 10 minutes. Prove that two holds on the last seat cannot both succeed. 

- Hotel booking + hold (HTL-16, HTL-18): one or more rooms of the same hotel for the same dates, all rooms or none, never overlapping (MongoDB transaction or a room-night collection with a unique index on roomId + date). 

- Confirmation (FLT-23, HTL-17): the webhook moves Pending Payment -> Confirmed, generates the unique booking reference, and the flight e-ticket PDF download (add pdfkit or similar to package.json). 

- Booking lifecycle (GEN-11) and automation (NEW-01): a @Cron job every minute expires holds and releases seats / room-nights, and marks finished trips and stays Completed. Expiry is re-checked at payment time. 

- Cancellation + refunds (FLT-26, HTL-21, PAY-03): apply the cancellation tier rule (Area 5 tiers for flights, Area 7 tiers for hotels), release the inventory, create the Stripe refund and expose its status. Booking details show the refund the user would get before cancelling. 

- Expose confirm / release / refund functions for Area 5 (flight cancellation by the airline gives 100% refunds) and call NotificationsService (Area 3) on confirmation, cancellation and refund. 

- Rehearse demo scenarios 3-8 end to end in Swagger with the Stripe CLI forwarding webhooks. 

## **4. Dependencies** 

|**Others nee**|**d from you**|**You nee**|**d from others**|
|---|---|---|---|
|**Who**|**What**|**From**|**What**|
|Areas 3, 6|Flight booking + hotel reservation schemas<br>(admin overview, my bookings, flight manifest,<br>reservation list) (GEN-11, ACC-17, FLT-29, HTL-<br>22)|Area 3<br>Area 2|Error format, ValidationPipe, pagination, shared<br>enums (GEN-02, GEN-05, GEN-13)<br>User schema, login, cookies, JwtAuthGuard /<br>RolesGuard / @CurrentUser, ownership helper (ACC-|
|Area 5|Flight booking schema (no airport change or seat<br>cut below booked; notify affected bookings)<br>(GEN-11, FLT-05, NEW-02)|Area 3|04, ACC-11, ACC-19)<br>Raw request body for the Stripe webhook (main.ts)<br>(PAY-01)|
|Area 7<br>Area 4|Reservation + hold data (Booked in the room<br>calendar, free rooms and search; no blocking<br>over reservations) (HTL-18, HTL-06, HTL-08, HTL-<br>11, HTL-15)<br>Reservation schema with the Completed status<br>(reviews only after a stay) (GEN-11, NEW-01,|Area 5<br>Area 7|Flight + cabin schemas with total / booked / held<br>seat counters and flight status (FLT-03, FLT-04, FLT-<br>30)<br>Room + availability schemas (HTL-03, HTL-04, HTL-<br>06)|
||HTL-23)|Area 3|NotificationsService (GEN-01)|
|Area 6|Refund preview in booking details (FLT-26, HTL-<br>21)|Area 5|Airline baggage + cancellation policies and the<br>shared tier rule (shown before payment, used for<br>refunds) (FLT-08, FLT-09, PAY-02)|



3abeed Khaled 

|Area 5|Refund function (airline cancels a flight: 100%|Area 7|Hotel check-in / check-out times + cancellation tiers|
|---|---|---|---|
||refunds) (PAY-03, FLT-06)||(shown before payment, used for refunds) (HTL-09,|
||||HTL-10, PAY-02)|
|||Area 6|Booking summary (passengers, baggage) that hands|
||||off to the seat hold (FLT-19, FLT-21)|
|||Until it is<br>document|merged, code against the agreed interface (e.g. insert test<br>s directly in Atlas).|



## **5. Workflow for each requirement** 



<!-- Start of picture text -->
Excel id → GitHub issue → git grep id → Branch → Schema · DTO · Service · Route → Test in Swagger →<br>PR → develop → Review & merge<br><!-- End of picture text -->

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

- Lists are paginated (10 per page). 

- Matches docs/api/openapi.yaml, or the file is updated in the same PR. 

- Merged into develop through a reviewed PR that says "Closes #<issue>". 

- AI_PROMPTS.txt updated if AI was used. 

- (3) Round-trip search with an adult, a child and an infant; hold; accept policies; pay; confirmed with a reference and e-ticket. 

- (4) Two simultaneous holds on the last seat: only one succeeds. 

- (5) A hold expires after 10 minutes and its seats are released. 

- (6) The user cancels: the refund tier is applied and the refund is visible. 

- (7) The airline cancels a flight: 100% refunds and notifications. 

- (8) Multi-room hotel booking; an overlapping request is rejected; a review after the stay. 

Rules every area follows in its own module: GEN-02 validation messages, GEN-04 empty lists, GEN-05 pagination (10 per page), GEN-11 booking lifecycle, GEN-13 backend enforces every rule. 

3abeed Khaled Co) 

Travel Planning & Booking Platform · Software Project I, Winter 2026 · Milestone 1 (Backend & Swagger) 

