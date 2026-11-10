3abeed Khaled 

# **Area 4: Blog, Reviews & Media** 

### **Assigned to:** 

Milestone 1 task sheet · backend + Swagger 

**Your goal:** All community content: the blog (posts, drafts, tags, search, comments, likes, author pages), hotel reviews and ratings, and the image-upload validation that every area with photos uses. 

**Your folders:** `blog/, reviews/, uploads/` 

|15<br>REQUIREMENTS|19<br>PDF ENDPOINTS|
|---|---|



8 

TASKS 

## **1. Your requirements (GitHub issues)** 

|**Issue**|**Id**|**Requirement**|**Complexity**|
|---|---|---|---|
|#70|**BLG-01**|Create a post with a required title and body, optional tags and images…|**low**|
|#71|**BLG-02**|Browse a paginated list of published posts filterable by tag, and open…|**low**|
|#72|**BLG-03**|List their own posts, including drafts, with title, status, date, like…|**low**|
|#73|**BLG-04**|Edit and delete their own posts|**low**|
|#74|**BLG-05**|Comment on a published post (non-empty, max 500 characters), shown in…|**low**|
|#75|**BLG-06**|Like a post once and remove the like, showing the like count|**low**|
|#76|**BLG-07**|Edit and delete their own comments|**low**|
|#77|**BLG-08**|Add up to 5 tags (max 30 characters each) to a post and edit them later|**low**|
|#122|**BLG-09**|Search published posts by keyword in title, tags or author name…|**medium**|
|#78|**BLG-10**|Attach images to a post under the shared media-upload rule (GEN-08) and…|**medium**|
|#113|**BLG-11**|Browse published posts by tag (case-insensitive, paginated, newest…|**low**|
|#79|**BLG-12**|A public author page showing the author's name, join date, published…|**low**|
|#87|**GEN-08**|Image uploads in JPG or PNG format, up to 5 MB each, with up to 5…|**medium**|
|#50|**HTL-23**|A Confirmed reservation becomes Completed once its check-out date has…|**medium**|
|#51|**HTL-24**|View a hotel's average rating, number of ratings and reviews (newest…|**low**|



## **2. Your endpoints** 

|**Method**|**Path**|**Requirements**|
|---|---|---|
|**`POST`**|`/api/posts`|BLG-01|
|**`GET`**|`/api/posts`|BLG-02, BLG-09, BLG-11|
|**`GET`**|`/api/posts/:id`|BLG-02|
|**`GET`**|`/api/posts/mine`|BLG-03|
|**`PATCH`**|`/api/posts/:id`|BLG-04, BLG-08|
|**`DELETE`**|`/api/posts/:id`|BLG-04|
|**`POST`**|`/api/posts/:id/comments`|BLG-05|
|**`PATCH`**|`/api/comments/:id`|BLG-07|
|**`DELETE`**|`/api/comments/:id`|BLG-07|
|**`POST`**|`/api/posts/:id/like`|BLG-06|



|3abeed Khaled|
|---|



|**`DELETE`**|`/api/posts/:id/like`|BLG-06|
|---|---|---|
|**`POST`**|`/api/posts/:id/images`|BLG-10, GEN-08|
|**`DELETE`**|`/api/posts/:id/images/:imageId`|BLG-10|
|**`GET`**|`/api/tags/:tag/posts`|BLG-08, BLG-11|
|**`GET`**|`/api/authors/:id`|BLG-12|
|**`POST`**|`/api/hotel-bookings/:id/review`|HTL-23|
|**`PATCH`**|`/api/reviews/:id`|HTL-23|
|**`DELETE`**|`/api/reviews/:id`|HTL-23|
|**`GET`**|`/api/hotels/:id/reviews`|HTL-24|



## **3. Your tasks** 

- Upload validation shared by everyone: JPG / PNG only, max 5 MB, max 5 images per item, stored in backend/uploads/ and served at /uploads (GEN-08). 

Post schema + create as Draft or Published with a required title and body (BLG-01). 

- Public paginated list and detail of published posts (BLG-02); my posts including drafts (BLG-03); edit / delete own posts (BLG-04). 

- Tags: up to 5 per post, max 30 characters, normalised (BLG-08); browse by tag, case-insensitive (BLG-11); keyword search in title, tags or author (BLG-09). 

Post images with the shared upload rule: add and remove (BLG-10). 

- Comments: add, edit / delete own (BLG-05, BLG-07). Likes: at most one per user per post with a unique index (BLG06). 

Public author page (BLG-12); hidden posts and comments (GEN-10, Area 3) are excluded from public lists. 

- Hotel reviews (HTL-23): only for a Completed stay, one per reservation, edit / delete own; hotel average rating, count and list, newest first (HTL-24); hidden flag (GEN-10). 

## **4. Dependencies** 

|**Others need**|**from you**|**You nee**|**d from others**|
|---|---|---|---|
|**Who**|**What**|**From**|**What**|
|Areas 5, 7, 8|Image upload validation (GEN-08)|Area 3|Error format, ValidationPipe, pagination, shared|
|Area 3|Post, comment and review schemas with a||enums (GEN-02, GEN-05, GEN-13)|
||hidden flag (GEN-09, GEN-10)|Area 2|User schema, login, cookies, JwtAuthGuard /|
||||RolesGuard / @CurrentUser, ownership helper (ACC-<br>04, ACC-11, ACC-19)|
|||Area 7|Hotel schema (reviews and the reservation list<br>belong to a hotel) (HTL-01, HTL-22, HTL-24)|
|||Area 1|Reservation schema with the Completed status<br>(reviews only after a stay) (GEN-11, NEW-01, HTL-23)|



Until it is merged, code against the agreed interface (e.g. insert test documents directly in Atlas). 

## **Bonus (only after all your mandatory work is merged)** 

|#109|**BLG-13**|Attach an itinerary to a post|
|---|---|---|
|#106|**HTL-26**|Reply to a review|



3abeed Khaled 

## **5. Workflow for each requirement** 

**Excel id → GitHub issue → git grep id → Branch → Schema · DTO · Service · Route → Test in Swagger → PR → develop → Review & merge** 

- **1 Pick the requirement.** Take the next id from your list (respect "Dependencies"). Open its GitHub issue and read the requirement and the definition of done. 

- **2 Find where it goes.** Run `git grep FLT-11` : the controller comment shows the endpoint(s), the schema / DTO comments show what to model. openapi.yaml shows the exact request, response and status codes. 

- **3** 

   - **Create a branch.** `git checkout develop` → `git pull` → `git checkout -b feature/FLT-11-flight-search` 

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

- (8) Multi-room hotel booking; an overlapping request is rejected; a review after the stay. 

- (10) A post is reported, and the admin hides it; the audit log shows the action. 

Rules every area follows in its own module: GEN-02 validation messages, GEN-04 empty lists, GEN-05 pagination (10 per page), GEN-11 booking lifecycle, GEN-13 backend enforces every rule. 

- Matches docs/api/openapi.yaml, or the file is updated in the same PR. 

- Merged into develop through a reviewed PR that says "Closes #<issue>". 

- AI_PROMPTS.txt updated if AI was used. 

Travel Planning & Booking Platform · Software Project I, Winter 2026 · Milestone 1 (Backend & Swagger) 

