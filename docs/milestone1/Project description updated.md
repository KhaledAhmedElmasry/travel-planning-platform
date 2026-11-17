### **German International University Faculty of Informatics and Computer Science** 

Dr. Nada Sharaf 

TA. Rahma Amin 

TA. Menna Singergy 

TA. Hassan Osama 

TA. Moamen Atia 

TA. Amr Samir 

TA. Amir Haytham 

TA. Mohamed Yasser 

TA. Donia Ali 

TA. Mohamed ElMaadawy 

### **Software Project I** , Winter 2026 **Travel Planning and Booking Platform Project Description** 

<mark>Note: Changes mad</mark> e to <mark>the pdf are highlighted</mark> in <mark>yellow.</mark> 

# **1 Project Overview** 

The goal of this project is to design and implement a complete **web-based Travel Planning and Booking Platform** that integrates flight booking, hotel booking, itinerary planning, budgeting, and travel-content sharing into one coherent system. 

The platform serves multiple types of users. Travelers can search for flights and hotels, make and manage bookings, construct day-by-day itineraries, calculate trip budgets, publish itineraries, and share travel experiences through blog posts. 

Airline and hotel moderators manage the inventory and policies of their assigned providers, while administrators supervise accounts, moderators, bookings, and community content. 

The final application must demonstrate a well-designed data model, role-based authorization, ownership restrictions, consistent booking and availability information, and integration between the backend and frontend. 

## **1.1 Technology Stack and MVC Architecture** 

The project must follow the **Model–View–Controller (MVC)** architectural pattern using the following technologies: 

- **Model – MongoDB Atlas and NestJS:** MongoDB Atlas stores the application data. NestJS schemas/models represent domain entities, while services implement business logic, validation, and database operations. 

- **View – Next.js:** Next.js (React and TypeScript) provides the frontend interface, including public pages, booking workflows, itinerary editors, and role-specific dashboards. 

- **Controller – NestJS:** NestJS controllers receive HTTP requests, validate incoming data through the application’s validation mechanisms, invoke the appropriate services, and return REST API responses. 

- The application consists of one **NestJS backend** , one **Next.js frontend** , and one **shared MongoDB Atlas database** . 

Backend functionality must be organized into feature-based modules, such as Authentication, Flights, Hotels, Payments, Itineraries, Blog, and Administration. 

1 

# **2 Official Requirements and User Stories** 

The detailed functional requirements, user stories, and acceptance criteria are provided in the official Excel requirements sheet. 

The Excel sheet is considered an **integral and authoritative part** of this project description. 

### **Project Requirements and User Stories** 

Each requirement has a unique identifier, such as `ACC-01` , `FLT-11` , `HTL-16` , `PAY-01` , `ITN-21` , and `BLG-01` . These identifiers should be referenced in relevant GitHub issues, pull requests, commit messages, and API documentation to maintain traceability. 

The official workbook distinguishes between **mandatory requirements** and **optional bonus requirements** . 

Teams must prioritize mandatory requirements. Optional features must not replace required functionality. 

# **3 Project Objectives** 

By completing this project, students should demonstrate their ability to: 

- analyze requirements and translate them into an MVC-based full-stack application; 

- design appropriate MongoDB schemas and model relationships between domain entities; 

- design and implement RESTful APIs using NestJS; 

- implement authentication, authorization, ownership checks, and role-based access control; 

- implement searching, filtering, sorting, pagination, and server-side validation; 

- handle booking availability, inventory holds, and concurrency-sensitive operations; 

- implement provider policies, payments, cancellations, and refunds; 

- integrate booking functionality with itinerary planning and budgeting; 

- develop responsive frontend interfaces using Next.js; 

- implement community and moderation functionality; 

- collaborate using a professional Git/GitHub workflow. 

# **4 System Actors and Roles** 

|**Actor**|**Role and Responsibilities**|
|---|---|
|Guest|An unauthenticated visitor who may search flights and hotels, inspect available<br>options, and browse public blog posts and itineraries. Restricted actions require<br>authentication.|
|Registered User|A traveler who manages a profile, books flights and hotels, manages bookings,<br>creates itineraries and budgets, publishes or clones public itineraries, creates<br>blog posts, comments, likes, submits eligible hotel reviews, and reports inappro-<br>priate content.|
|Administrator|Manages platform accounts, creates moderator accounts, suspends/reactivates<br>users and moderators, inspects bookings, handles reports, moderates content,<br>and reviews audit logs.|
|Airline Moderator|Manages exactly one assigned airline, including its profile, flights, cabin inven-<br>tory, prices, baggage rules, cancellation policies, and booking information.|
|Hotel Moderator|Manages exactly one assigned hotel, including its profile, rooms, availability,<br>prices, policies, and reservations.|
|System / Automated<br>Services|Handles payment confirmation, inventory-hold expiry, notifications, exchange-<br>rate retrieval, booking-state updates, and audit logging.|



# **5 Core Domain Entities** 

Students must design suitable MongoDB schemas and correctly represent relationships between entities. 

2 

Embedded documents may be used for bounded, parent-owned data, while references may be used for shared or independently changing data. 

The following table summarizes the main domain entities. Students may introduce additional supporting entities when technically justified. 

|**Domain**|**Entities and Relationships**|
|---|---|
|Accounts and Roles|**User Account, Moderator Assignment.** Users store authentication cre-<br>dentials, profile information, roles, preferences, and account status. Modera-<br>tor assignments restrict management to one provider.|
|Flights|**Airline, Airport, Flight, Cabin Inventory, Airline Policy.**Each flight<br>belongs to an airline, references departure and arrival airports, and contains<br>cabin capacity, pricing, status, and applicable policies.|
|Flight Bookings|**Flight Booking, Passenger.** Bookings belong to users and contain selec-<br>ted flights, passengers, baggage, agreed prices, booking references, payment<br>information, and booking states.|
|Hotels|**Hotel, Room, Room Availability, Hotel Policy.** Hotels contain indivi-<br>dually bookable rooms with occupancy, pricing, availability, blocked dates,<br>and provider policies.|
|Hotel Bookings|**Hotel Booking, Review.** Reservations belong to users, reference selected<br>rooms and stay dates, and record booking/payment states. Eligible comple-<br>ted reservations may receive reviews.|
|Payments|**Payment, Refund.** Payment and refund records reference bookings and<br>store amounts, transaction identifiers, states, timestamps, and applicable<br>policy information.|
|Itineraries|**Itinerary, Itinerary Day, Activity, Budget Entry, Transport Cost,**<br>**Exchange Rate.** Itineraries contain ordered days, cities, activities, budget<br>information, and transport costs. Public clones preserve attribution.|
|Community|**Blog Post, Comment, Like, Tag.** Posts belong to authors and support<br>draft/published states, comments, likes, searchable tags, and media.|



## **5.1 Reference Data and Database Seeding** 

To ensure consistency across all teams, all teams must initialize their MongoDB database using the provided reference datasets for **countries, cities, airports, and attractions** . <mark>Each airport</mark> i <mark>ncludes its IANA</mark> t <mark>ime</mark> zone in <mark>Airports.csv, and the supported currencies are the currenc</mark> y co <mark>des</mark> li <mark>sted</mark> in <mark>the Countries.csv</mark> 

The reference datasets are available at: 

### **Official Reference Datasets** 

**Important:** The provided datasets will be used during the final project evaluation. Therefore, all teams must ensure that their application supports the same reference records and identifiers. 

# **6 Functional Scope** 

This section summarizes the main functionality. The official requirements sheet defines the exact business rules, limits, and acceptance criteria. 

## **6.1 Accounts and Administration** 

The system must support user registration, authentication, logout, password changes, profile management, and account deactivation according to the requirements. 

Account email addresses must be unique. Authentication must enforce the required password rules, failedlogin lockout, session expiry, and account status. 

Role-based authorization is mandatory. Users must not access another user’s private bookings or itineraries. 

3 

Airline and hotel moderators may manage only their assigned provider. 

Administrators create moderator accounts, manage account status, inspect platform bookings, and moderate reported content. 

Administrator accounts must be seeded; administrator self-registration is not permitted. 

Admin-assisted password reset is mandatory. Email verification and email-based forgotten-password recovery are **optional bonus features** . 

## **6.2 Flights** 

Airline moderators manage airline profiles, flights, cabin categories, prices, baggage allowances, extrabaggage rules, cancellation policies, schedule modifications, and flight cancellations. 

Guests and registered users can search for one-way and round-trip flights by route, travel dates, passenger types/counts, and cabin class. 

Search results must support the required filtering and sorting options. 

Registered users enter passenger and baggage details, review the booking summary, accept applicable policies, and proceed to payment. 

Flight inventory must be protected through **concurrency-safe temporary holds** . Holds expire after the period specified in the requirements sheet, releasing unused inventory. 

After successful payment verification, the booking becomes confirmed and receives a unique reference and e-ticket. 

Users can inspect their bookings and cancel eligible reservations according to airline policies. 

Flight booking changes and seat selection are optional bonuses. 

## **6.3 Hotels** 

Hotel moderators manage hotel profiles, individually bookable rooms, availability, pricing, blocked dates, check-in/check-out times, cancellation policies, and reservations. 

Guests and registered users search hotels by destination, dates, and guest count, with filtering and sorting. Registered users can inspect available rooms, select one or more rooms in the same hotel, review the total price and policies, and proceed to payment. 

The backend must protect room inventory against concurrent reservations and overlapping bookings. 

When multiple rooms are selected, the reservation must be handled consistently as one operation. Users can inspect and cancel eligible reservations. After a completed stay, users may submit reviews according to the eligibility rules in the requirements sheet. 

Hotel moderator replies to reviews are optional bonuses. 

## **6.4 Payments and Refunds** 

Flight and hotel payments must use **Stripe test mode** . The backend must verify payment outcomes before confirming bookings. 

Provider policies must be displayed and accepted before payment, and acceptance must be recorded. Failed or expired payments must leave bookings unconfirmed and release inventory when required. Cancellation and refund calculations must follow the policy applicable to the booking. Users must be able to inspect payment and refund status. 

The application must not store raw card information. 

4 

## **6.5 Itinerary Planning and Budgeting** 

Registered users create itineraries containing titles, countries, start dates, ordered days, cities, activities, images, and budget entries. 

Itinerary dates are derived from the start date and the order of days. 

Adding, deleting, or reordering days must update day numbering, dates, city grouping, and budget calculations consistently. 

Budget entries cover food, accommodation, local transportation, and activities, with separate intercity transportation costs. 

Budget totals must support currency conversion using exchange rates retrieved from **FXRatesAPI** . 

Students must integrate FXRatesAPI through the NestJS backend to retrieve exchange rates and convert itinerary budget amounts into the user’s selected display currency. 

The system must handle invalid currency codes, unavailable exchange rates, and API request failures. API credentials, if required, must be stored securely and must not be exposed to the frontend. 

Itineraries may be public or private. Private itineraries are accessible only to their owners. 

Public itineraries can be searched and viewed by others. A registered user may clone a public itinerary into an independent private copy that preserves attribution. 

Flight and hotel searches must be reusable from the itinerary context where required. 

Attaching confirmed bookings to itineraries and exporting itineraries as PDF are optional bonuses. 

## **6.6 Blog and Community** 

Registered users can create blog posts in Draft or Published status. 

Published posts are publicly accessible and support searching, tags, author pages, comments, and likes. Authors may edit or delete their own posts. Users may manage their own comments. 

A user may like a particular post at most once. 

Users may report supported content. Administrators review reports and may dismiss them, hide content, or delete inappropriate content. 

Important moderation actions must be auditable. 

## **6.7 Shared System Behavior** 

The platform must implement: 

- server-side validation and consistent error responses; 

- filtering, sorting, and pagination; 

- appropriate image-upload validation; 

- mandatory in-app notifications; 

- administrative audit logging; 

- correct handling of airport time zones; 

- confirmation before destructive actions; 

- meaningful loading, error, and empty states. 

Email notifications are optional bonuses. 

# **7 Development Milestones** 

The project is divided into **two major milestones** . Each milestone must produce a demonstrable, reviewable version of the application. 

## **7.1 Milestone 1: Backend & API - Deadline ( 20/11)** 

Milestone 1 focuses on the **NestJS backend and MongoDB data layer** . 

5 

By the end of this milestone, teams must: 

- design and implement MongoDB schemas; 

- organize backend functionality into NestJS modules, controllers, services, and models; 

- implement authentication and authorization; 

- implement the required REST API; 

- enforce booking and inventory consistency; 

- implement payment, cancellation, and refund business logic; 

- implement itinerary, blog, and moderation logic; 

- provide server-side validation and error handling; 

- document and demonstrate APIs through Swagger UI. 

A frontend is not required for Milestone 1. 

## **7.2 Milestone 2: Frontend & Integration - Deadline ( 11/12)** 

Milestone 2 focuses on implementing the **Next.js frontend** and integrating it with the completed backend. 

The frontend must provide: 

- responsive public and authenticated pages; 

- registration, login, and profile management; 

- flight and hotel search and booking workflows; 

- payment and cancellation interfaces; 

- itinerary creation, editing, budgeting, and sharing; 

- blog and community interfaces; 

- airline and hotel moderator dashboards; 

- administrator management and moderation interfaces; 

- appropriate loading, error, and confirmation states. 

**Frontend validation and route protection must not replace backend validation and authorization.** 

## **7.3 Optional Cloud Deployment Bonus** 

Deploying the complete application to any cloud-based platform is considered an **optional bonus** . To qualify for this bonus, students must deploy both the frontend and backend and ensure that the application is fully functional in the deployed environment. 

**Important:** Teams applying for this bonus will be evaluated exclusively on the **deployed version** of their application. The locally running version will not be considered when evaluating the deployment bonus. 

# **8 Milestone 1: Required Backend API and DB Setup** 

The following endpoints represent the expected API coverage. 

Students may introduce additional endpoints when justified. Endpoint names may differ slightly, provided the API remains RESTful, consistent, documented, and capable of satisfying the official requirements. Endpoints corresponding to optional features are marked **Optional** . 

## **8.1 Authentication and Accounts** 

|**Method**|**Endpoint**|**Requirement**|
|---|---|---|
|POST|`/api/auth/register`|ACC<br>-<br>01|
|GET|`/api/auth/verify-email`|ACC-02 (Optional)|
|POST|`/api/auth/login`|ACC-04, ACC-05|
|POST|`/api/auth/logout`|ACC-06|



6 

|**Method**|**Endpoint**|**Requirement**|
|---|---|---|
|POST|`/api/auth/forgot-password`|ACC-07 (Optional)|
|POST|`/api/auth/reset-password`|ACC-07 (Optional)|
|POST|`/api/admin/users/:id/reset-password`|ACC-07a|
|PATCH|`/api/auth/change-password`|ACC-08|
|GET|`/api/auth/me`|ACC<br>-<br>04,<br>ACC<br>-<br>19|
|GET|`/api/users/me`|ACC-11|
|PATCH|`/api/users/me`|ACC-09|
|DELETE|`/api/users/me`|ACC-12|



Authentication must enforce session expiry, account suspension, ownership, and role-based authorization. Authentication tokens must not be stored in browser-accessible `localStorage` or `sessionStorage` . Use secure `httpOnly` cookies. 

## **8.2 Administration** 

|**Method**|**Endpoint**|**Requirement**|
|---|---|---|
|POST|`/api/admin/moderators`|ACC-13|
|GET|`/api/admin/accounts`|ACC-14|
|PATCH|`/api/admin/accounts/:id/suspend`|ACC-15, ACC-16|
|PATCH|`/api/admin/accounts/:id/reactivate`|ACC-15, ACC-16|
|PATCH|`/api/admin/providers/:type/:id/deactivate`|ACC<br>-<br>15|
|PATCH|`/api/admin/providers/:type/:id/reactivate`|ACC<br>-<br>15|
|GET|`/api/admin/bookings`|ACC-17|
|GET|`/api/admin/reports`|GEN-09, GEN-10|
|PATCH|`/api/admin/reports/:id`|GEN-10|
|DELETE|`/api/admin/content/:type/:id`|GEN-10|
|GET|`/api/admin/audit-logs`|GEN-07|



<mark>Here, :type</mark> is <mark>hotel</mark> or <mark>airline. Dea</mark> ct <mark>ivating</mark> a <mark>provider</mark> is s <mark>epar</mark> ate <mark>from suspending its mod</mark> er <mark>ator</mark> a <mark>ccount:</mark> a deactiv <mark>ated hotel</mark> or <mark>airl</mark> ine is <mark>hidden from search and cannot be booked, whil</mark> e <mark>its existing Conf</mark> i <mark>rmed bookings</mark> r <mark>emain</mark> v <mark>alid. Affected parties must</mark> r <mark>eceiv</mark> e <mark>an</mark> in <mark>-app not</mark> ificat <mark>ion.</mark> 

## **8.3 Airlines, Flights, and Flight Inventory** 

|**Method**|**Endpoint**|**Requirement**|
|---|---|---|
|POST|`/api/airlines`|FLT-01|
|GET|`/api/airlines/:id`|FLT-01|
|PATCH|`/api/airlines/:id`|FLT-01|
|GET|`/api/airports`|FLT<br>-<br>02|
|POST|`/api/flights`|FLT-03|
|GET|`/api/flights/search`|FLT-11, FLT-12, FLT-15|
|GET|`/api/flights/:id`|FLT-17|
|PATCH|`/api/flights/:id`|FLT-05|
|POST|`/api/flights/:id/cancel`|FLT-06|
|POST|`/api/flights/:id/cabins`|FLT-04|
|PATCH|`/api/flights/:id/cabins/:cabinId`|FLT-04, FLT-05|
|PUT|`/api/airlines/:id/baggage-policy`|FLT-04, FLT-08|
|PUT|`/api/airlines/:id/cancellation-policy`|FLT-09|
|GET|`/api/flights/:id/bookings`|FLT-29|
|GET|`/api/flights/:id/passengers/export`|FLT-29|



Flight search must support the required one-way and round-trip parameters, passenger counts/types, cabin classes, price filtering, and sorting. 

7 

## **8.4 Flight Booking** 

|**Method**|**Endpoint**|**Requirement**|
|---|---|---|
|POST|`/api/flight-bookings/hold`|FLT-22|
|POST|`/api/flight-bookings`|FLT-19, FLT-21|
|GET|`/api/flight-bookings`|FLT-25|
|GET|`/api/flight-bookings/:id`|FLT-25|
|POST|`/api/flight-bookings/:id/cancel`|FLT-26|
|PATCH|`/api/flight-bookings/:id/change-flight`|FLT-27 (Optional)|
|GET|`/api/flight-bookings/:id/e-ticket`|FLT-23|
|PATCH|`/api/flight-bookings/:id/seat`|FLT-28 (Optional)|



The backend must ensure that concurrent booking requests cannot reserve more seats than the available inventory. 

Inventory holds must expire and release capacity according to the official requirements. 

## **8.5 Hotels and Rooms** 

|**Method**|**Endpoint**|**Requirement**|
|---|---|---|
|POST|`/api/hotels`|HTL-01|
|GET|`/api/hotels/search`|HTL-11, HTL-12|
|GET|`/api/hotels/:id`|HTL-02|
|PATCH|`/api/hotels/:id`|HTL-01|
|POST|`/api/hotels/:id/rooms`|HTL-03|
|PATCH|`/api/hotels/:id/rooms/:roomId`|HTL-05|
|DELETE|`/api/hotels/:id/rooms/:roomId`|HTL-06|
|GET|`/api/hotels/:id/rooms/available`|HTL-15|
|POST|`/api/hotels/:id/rooms/:roomId/availability`|HTL-04|
|PATCH|`/api/hotels/:id/rooms/:roomId/availability`|HTL-05, HTL-06|
|GET|`/api/hotels/:id/availability`|HTL-08|
|PUT|`/api/hotels/:id/policies`|HTL<br>-<br>09,<br>HTL<br>-<br>10|
|GET|`/api/hotels/:id/reservations`|HTL-22|



## **8.6 Hotel Booking and Reviews** 

|**Method**|**Endpoint**|**Requirement**|
|---|---|---|
|POST|`/api/hotel-bookings`|HTL-16, HTL-18|
|GET|`/api/hotel-bookings`|HTL-20|
|GET|`/api/hotel-bookings/:id`|HTL-20|
|POST|`/api/hotel-bookings/:id/cancel`|HTL-21|
|POST|`/api/hotel-bookings/:id/review`|HTL-23|
|PATCH|`/api/reviews/:id`|HTL-23|
|DELETE|`/api/reviews/:id`|HTL-23|
|GET|`/api/hotels/:id/reviews`|HTL-24|
|POST|`/api/reviews/:id/reply`|HTL-26 (Optional)|



Hotel bookings must be concurrency-safe. The system must prevent overlapping reservations from consuming the same room inventory. 

## **8.7 Payments and Refunds** 

|**Method**|**Endpoint**|**Requirement**|
|---|---|---|
|GET|`/api/bookings/:type/:id/policies`|PAY-02|



8 

|**Method**|**Endpoint**|**Requirement**|
|---|---|---|
|POST|`/api/bookings/:type/:id/accept-policies`|PAY-02|
|POST|`/api/payments`|PAY-01|
|POST|`/api/payments/:id/retry`|PAY-01|
|GET|`/api/payments/:id`|PAY-01|
|POST|`/api/payments/webhook`|PAY-01|
|GET|`/api/refunds/:id`|PAY-03|



Policy acceptance must be stored with a timestamp. The backend must not confirm a booking before successful payment verification. 

## **8.8 Itineraries** 

|**Method**|**Endpoint**|**Requirement**|
|---|---|---|
|POST|`/api/itineraries`|ITN-01|
|GET|`/api/itineraries`|ITN-03|
|GET|`/api/itineraries/:id`|ITN-03|
|PATCH|`/api/itineraries/:id`|ITN-01, ITN-20|
|DELETE|`/api/itineraries/:id`|ITN-01|
|POST|`/api/itineraries/:id/days`|ITN-05|
|PATCH|`/api/itineraries/:id/days/:dayId`|ITN-05|
|DELETE|`/api/itineraries/:id/days/:dayId`|ITN-07|
|PATCH|`/api/itineraries/:id/days/reorder`|ITN-08|
|POST|`/api/itineraries/:id/days/:dayId/activities`|ITN-10|
|PATCH|`/api/activities/:id`|ITN-10|
|DELETE|`/api/activities/:id`|ITN-10|
|POST|`/api/activities/:id/images`|ITN-12, GEN-08|
|DELETE|`/api/activities/:id/images/:imageId`|ITN-12|
|POST|`/api/itineraries/:id/days/:dayId/budgets`|ITN-14|
|PATCH|`/api/budgets/:id`|ITN-14|
|DELETE|`/api/budgets/:id`|ITN-14|
|POST|`/api/itineraries/:id/transport-costs`|ITN-16|
|PATCH|`/api/transport-costs/:id`|ITN-16|
|DELETE|`/api/transport-costs/:id`|ITN-16|
|GET|`/api/itineraries/:id/budget-summary`|ITN-14, ITN-18|
|GET|`/api/itineraries/public/search`|ITN-20, ITN-21|
|GET|`/api/itineraries/public/:id`|ITN-21|
|POST|`/api/itineraries/:id/clone`|ITN-21|
|GET|`/api/itineraries/:id/hotels`|ITN<br>-<br>25|
|GET|`/api/itineraries/:id/flights`|ITN-26|
|POST|`/api/itineraries/:id/bookings`|ITN-27 (Optional)|
|GET|`/api/itineraries/:id/pdf`|ITN-28 (Optional)|



Private itinerary endpoints must enforce ownership checks. Client-side route protection alone is insufficient. 

## **8.9 Blog** 

|**Method**|**Endpoint**|**Requirement**|
|---|---|---|
|POST|`/api/posts`|BLG-01|
|GET|`/api/posts`|BLG<br>-<br>02,<br>BLG<br>-<br>09|
|GET|`/api/posts/:id`|BLG-02|
|GET|`/api/posts/mine`|BLG-03|
|PATCH|`/api/posts/:id`|BLG-04, BLG-08|



9 

|**Method**|**Endpoint**|**Requirement**|
|---|---|---|
|DELETE|`/api/posts/:id`|BLG-04|
|POST|`/api/posts/:id/comments`|BLG-05|
|PATCH|`/api/comments/:id`|BLG-07|
|DELETE|`/api/comments/:id`|BLG-07|
|POST|`/api/posts/:id/like`|BLG-06|
|DELETE|`/api/posts/:id/like`|BLG-06|
|POST|`/api/posts/:id/images`|BLG-10, GEN-08|
|DELETE|`/api/posts/:id/images/:imageId`|BLG-10|
|GET|`/api/tags/:tag/posts`|BLG<br>-<br>08|
|GET|`/api/authors/:id`|BLG-12|
|PATCH|`/api/posts/:id/itinerary`|BLG-13 (Optional)|



## **8.10 Supporting Services** 

The backend must also implement the required operations for content reporting, media uploads, notifications, exchange-rate retrieval, and administrative audit records. 

These services may expose additional REST endpoints as needed to satisfy the official requirements. 

## **8.11 MongoDB Setup** 

Each team must use a **shared MongoDB Atlas database** . 

The **team leader** is responsible for creating and configuring the database and securely providing the connection string to the rest of the team. 

Each team member must store the connection string in a local `.env` file: 

```
MONGODB_URI=<team-mongodb-atlas-connection-string>
```

All team members must connect their local NestJS backend to the **same shared database** . The `.env` file must be added to `.gitignore` . 

Teams should include an `.env.example` documenting required environment variable names without exposing credentials. 

# **9 Next.js Rendering Requirements** 

Students are expected to understand that different pages have different rendering requirements. 

The entire application should not use a single rendering strategy. 

The following table provides recommended approaches. 

|**Page / Feature**|**Suggested Strategy**|
|---|---|
|Published Blog Post|ISR / Static Rendering|
|Blog Listing / Search|Dynamic SSR|
|Public Author Page|ISR / Static Rendering|
|Blog Editor / Drafts|Dynamic SSR + Client Components|
|Likes and Comments|Client Components|
|Public Itinerary Detail|ISR / Static Rendering|
|Public Itinerary Search|Dynamic SSR|
|Private Itinerary Detail|Dynamic SSR|
|Itinerary Editor|Dynamic SSR + Client Components|
|User Booking Pages|Dynamic SSR|
|Flight / Hotel Search|Dynamic SSR|
|Admin / Moderator Dashboards|Dynamic SSR|



10 

Students must justify their rendering decisions during evaluation. 

In the Next.js App Router, Client Components should be introduced where browser-side interactivity is required. 

Public pages should include appropriate metadata for SEO where applicable. 

# **10 Git and GitHub Development Workflow** 

All teams must use GitHub throughout development. 

Uploading the entire project only at the end of the semester is not acceptable. 

## **10.1 Repository Structure** 

A recommended repository structure is: 

```
project-root/
|
```

- `|-- backend/` 

- `|-- frontend/` 

- `|-- docs/` 

- `| |-- requirements/` 

- `| ‘-- api/` 

- `|` 

- `|-- AI_PROMPTS.txt` 

- `|-- README.md` 

- `|-- .env.example` 

- `|-- .gitignore` 

```
‘--
```

## **10.2 Main Branches** 

The repository should contain two long-lived branches: • `main` : stable milestone/release versions. • `develop` : integration branch for completed work. Students must not develop features directly on `main` . 

## **10.3 Feature Branches** 

New work must be implemented on short-lived branches created from the latest `develop` branch. Recommended conventions include: 

```
feature/<requirement-id>-<description>
fix/<requirement-id>-<description>
refactor/<description>
docs/<description>
```

Examples: 

```
feature/ACC-01-user-registration
feature/FLT-11-flight-search
feature/HTL-16-hotel-booking
fix/FLT-22-seat-hold-race-condition
```

Each feature branch should contain a coherent unit of work. 

11 

## **10.4 Typical Development Flow** 

For a new feature: 

```
gitcheckoutdevelop
gitpullorigindevelop
```

```
gitcheckout-bfeature/FLT-11-flight-search
```

```
#Implementthefeature
```

```
gitadd.
gitcommit-m"feat(flights):implementsearch"
```

```
gitpush-uoriginfeature/FLT-11-flight-search
```

The student then opens a pull request: `feature/FLT-11-flight-search ---> develop` After review and approval, the feature is merged. At milestone release: 

```
develop--->main
```

## **10.5 Pull Request Regulations** 

Each pull request should: 

- have a meaningful title and description; 

- reference relevant requirement IDs; 

- contain only related changes; 

- avoid committing secrets or environment files; 

- be reviewed by the team leader; 

- resolve important review comments before merging. 

## **10.6 Commit Message Convention** 

Students should use meaningful commit messages. Conventional Commit style is recommended: 

```
feat(auth):implementregistration
feat(flights):addround-tripsearch
fix(hotels):preventdoublebooking
refactor(payments):simplifyrefundlogic
docs(api):documentbookingendpoints
```

Avoid vague messages such as: 

```
update
changes
final
fix
```

## **10.7 Merge Conflicts and Collaboration** 

Students must regularly synchronize their branches with `develop` . 

Merge conflicts must be resolved carefully. The team leader is responsible for verifying that conflict resolution does not remove another team member’s work. 

Git history must demonstrate meaningful contributions throughout the project. 

12 

# **11 AI Usage Policy** 

Generative AI tools are **allowed** in this project. 

Examples include ChatGPT, GitHub Copilot, Claude, Gemini, and similar development assistants. AI tools may be used for: 

- explaining concepts; 

- brainstorming implementation approaches; 

- generating or reviewing code; 

- debugging and refactoring; 

- improving documentation. 

However, AI usage must be **transparent and documented** . 

## **11.1 Mandatory AI Prompt Log** 

Each repository must contain: 

```
AI_PROMPTS.txt
```

Students must record prompts that materially contributed to the submitted project. A recommended entry format is: 

```
================================================
Date:2026-10-10
Student:StudentName
Tool:ChatGPT
RelatedRequirement:FLT-22
```

```
Prompt:
```

```
Howcanconcurrentflightbookingsbehandled?
```

```
Howtheoutputwasused:
Usedtheexplanationtodesignthe
inventory-holdimplementation.
```

```
================================================
```

For multi-turn conversations, students may include the important prompts/responses or provide a chronological record explaining how AI contributed. 

## **11.2 AI Usage Regulations** 

- a) Students are responsible for all submitted code, including AI-generated code. 

- b) Students must understand and explain their implementation during project discussions. 

- c) AI-generated output must be reviewed before integration. 

- d) Sensitive information, passwords, tokens, and credentials must not be shared with AI tools. 

- e) The prompt log must be maintained throughout development. 

- f) Failure to disclose substantial AI-assisted work may violate submission regulations. 

The purpose of this policy is to encourage responsible AI-assisted development while maintaining transparency, accountability, and understanding. 

# **12 Optional Bonus Requirements** 

After completing mandatory requirements, teams may implement the optional bonus features listed in the official requirements workbook. 

These may include: 

13 

- email verification and email-based password recovery; 

- email notifications; 

- flight booking changes and seat selection; 

- • hotel moderator replies to reviews; 

- attaching confirmed bookings to itineraries; 

- itinerary PDF export; 

- attaching itineraries to blog posts; 

- administrator analytics and favourites, where specified in the workbook. 

The official workbook defines the exact scope and acceptance criteria for optional features. 

**Bonus features must not replace mandatory requirements.** 

Cloud deployment is not mandatory. The application may be developed and demonstrated locally using MongoDB Atlas and the required external services. 

# **13 Milestone Deliverables** 

## **13.1 Milestone 1: Backend** 

The backend milestone submission must contain: 

- fully implemented NestJS backend; 

- MongoDB Atlas integration; 

- documented REST API using Swagger; 

- README with setup instructions; 

- updated `AI_PROMPTS.txt` ; 

- Git history showing team contributions. 

**The backend will be evaluated through Swagger UI.** 

## **13.2 Milestone 2: Frontend and Final Integration** 

The final milestone submission must contain: 

- complete Next.js frontend; 

- integrated backend and frontend; 

- working mandatory workflows for all roles; 

- final README and setup instructions; 

- updated `AI_PROMPTS.txt` ; 

- complete GitHub contribution history. 

# **14 Important Notes** 

- The official Excel requirements sheet remains the authoritative source for individual functional requirements. 

- Students may introduce additional database entities, API endpoints, services, and components when technically justified. 

- Security, validation, and authorization must be implemented on the backend, even when frontend validation exists. 

- Students must understand and justify major architectural and implementation decisions during project discussions. 

- GitHub history and the AI prompt log form part of the submitted project material. 

14 

