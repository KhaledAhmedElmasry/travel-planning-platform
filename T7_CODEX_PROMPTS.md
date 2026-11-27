# T7 Codex prompts: Admin dashboard

P-48 Accounts is already merged into develop (#345, follow-up fix #346), so these cover the 6 remaining pages. Checked against develop at commit 6966fb4 (27 Nov 2026).

## Before you run any prompt
The spec leaves some UI details open, and AGENTS.md says not to guess them. I proposed answers on the lines marked [assumed]. **Send those lines to Khaled and edit anything he changes.** Pasting a prompt unchanged tells Codex to use my choices. The ones most worth checking:
- P-52: resolve only through the report endpoint, so the three direct content endpoints listed in your handout are not called on this page. Which actions need confirmation, and no note field.
- P-50: GET /api/cities is needed for the hotel form but is missing from your handout and the page header. Also check the table columns and filters.
- P-49: what happens after success, and whether deactivated providers can be selected.
- P-51: flight dates only, no times, because the API gives no airport time zone.
- P-49 adds one new component file that isn't in your handout.

## To use fewer credits
1. Run one prompt per **new** Codex session, so earlier pages aren't carried along.
2. Use a lower reasoning setting if your Codex offers one. Raise it only if a page fails (P-50 is the hardest).
3. Do the browser testing, merging, pushing and PR yourself.
4. If something breaks, paste only the error or describe one specific bug in the same session. Don't ask for a general review.

## For each page
Paste the prompt into a new Codex session. Codex creates the page's branch from the latest develop, builds the page and commits it there. It doesn't push.

After Codex finishes: test in the browser (admin on desktop and at 375 px; also check that a guest goes to login and a non-admin gets "forbidden"), including empty and error states. Check the AI_PROMPTS.txt entry. If you changed a prompt or sent a follow-up that mattered, log that too. Then:
```bash
git show --stat HEAD            # only that page's files + AI_PROMPTS.txt
# if your testing led to changes, commit them on the same branch
git fetch origin && git merge origin/develop
cd frontend && npm run lint && npm run typecheck && npm run build
git push -u origin <branch>
```
Every branch adds an entry at the end of AI_PROMPTS.txt, so after one page is merged, merging develop into another may conflict there. Keep both entries and remove the conflict markers.

Open the PR into develop with the description Codex drafted. Add the issue number and desktop + phone screenshots. Read the code before you submit it: you have to explain it at the evaluation.

---

## 1. P-53 Audit log

Branch: `feature/GEN-07-admin-audit-log-page`  
Commit: `feat(admin): build audit log page (GEN-07)`

````text
Build P-53 Audit log (/admin/audit-log), requirement GEN-07.

Branch step (before any edit): run git status. If there are uncommitted changes, stop and tell me. Otherwise run git checkout develop && git pull origin develop && git checkout -b feature/GEN-07-admin-audit-log-page. If any of these fails or the branch already exists, stop and tell me.

Follow AGENTS.md. This prompt already contains the spec text, API facts and kit facts for this task, copied from the repo.
To save credits:
- Edit only: frontend/src/app/admin/audit-log/page.tsx and frontend/src/components/app/admin/audit-log-table.tsx, and append to AI_PROMPTS.txt.
- Do NOT open docs/api/openapi.yaml, the .xlsx files, design-system/MASTER.md, frontend/README.md, or read AI_PROMPTS.txt. Everything needed is below.
- Open a kit file only if you need a prop not listed here. Read only the Next.js doc you need, only if unsure of an API.
- Pattern to copy for the server page: frontend/src/app/admin/accounts/page.tsx (requireUser(["admin"]), DashboardShell user + unreadNotifications from getUnreadCount(), PageHeader, async content inside <Suspense> with a Skeleton fallback, parsed searchParams (a Promise), backendJson, throw if null, metadata with title + robots index false). Format code normally, not as long one-line JSX.
- No new routes, libraries, tests, shared-file edits, inline styles or raw colors. If something is missing or contradicts the code, ask me one combined question before editing; don't explore widely or invent it.
- Don't run the dev server or browser tests (I will). Use only the git commands in the Branch and Commit steps. Never push, force, reset, stash or delete anything.
- Keep the header comment; remove only the TODO line (in each file you edit).

Global rules: loading, empty and error states; EmptyState when a list is empty; 10 per page with PaginationBar {page,totalPages,total,pageSize,hrefFor} keeping filters; works at 375px; Back/Cancel never loses unrelated data. A page past the last one shows an empty state with a link to page 1 [assumed]. The error page app/error.tsx already handles thrown errors.

Spec P-53: admin actions (suspensions, deletions, etc.) with date, admin, action and target. Paginated, filterable.
Rendering: Dynamic SSR (keep the table a server component).

API: GET /api/admin/audit-logs?action&from&to&page. from/to are YYYY-MM-DD. Newest first.
Returns {items,page,pageSize,total,totalPages}. Item: {id, admin:{id,name,email}, action, targetType, targetId, createdAt}.
action values: create_moderator, suspend_account, reactivate_account, reset_password, dismiss_report, hide_content, delete_content, deactivate_airline, reactivate_airline, deactivate_hotel, reactivate_hotel.

Kit: DataTable: caption, rows, rowKey, columns[{header (unique), cell(row), align?: "end", hideOnMobile?}], empty={<EmptyState .../>}. Keep 2-3 columns visible on phones. EmptyState: title, line?, description?, action?, compact?. formatDate from @/lib/format.
Filters are a plain <form method="get"> (no client code needed) with kit FormField, Input type="date", the kit Select with a name (value "all" = no filter), an Apply button and a "Clear filters" link. Submitting drops page (back to 1). Ignore invalid values from the URL and never send empty parameters. The API returns 400 if from > to, and backendJson throws on 400: check this BEFORE fetching and show "From date must not be after to date" [assumed] under the To field, keeping the form values.

UI [assumed]: filters = Action, From, To. Columns = Date, Admin (name), Action, Target (targetType and targetId; long ids must wrap). Action and target type text use sentence case like app/admin/admin-overview.tsx ("suspend_account" -> "Suspend account"). Empty: "No audit log entries"; with filters "No entries match these filters".

Finish: run once, in frontend/: npm run lint && npm run typecheck && npm run build. Fix errors in your files only.
Then append one entry to the END of AI_PROMPTS.txt with a shell append (don't read the file), exactly this layout:
================================================
Date: <today YYYY-MM-DD>
Student: Abdallah Mahmoud Abou Hussein
Tool: Codex
Related Requirement: GEN-07 (P-53 Audit log)

Prompt:
<short faithful summary of this prompt: page, filters, columns>

How the output was used:
<files built and which checks passed; don't claim browser testing>
================================================
Commit step: only if all three checks pass, git add the files you changed for this task by name (never git add -A), including AI_PROMPTS.txt, then git commit -m "feat(admin): build audit log page (GEN-07)". Do not push.

Reply with only: branch name, files changed, check results, commit hash, any [assumed] choice, and a PR description following .github/pull_request_template.md (use "Part of #<issue>", leave browser-test and screenshot boxes unticked).
````

---

## 2. P-51 All bookings

Branch: `feature/ACC-17-admin-bookings-page`  
Commit: `feat(admin): build all bookings page (ACC-17)`

````text
Build P-51 All bookings (/admin/bookings), requirement ACC-17.

Branch step (before any edit): run git status. If there are uncommitted changes, stop and tell me. Otherwise run git checkout develop && git pull origin develop && git checkout -b feature/ACC-17-admin-bookings-page. If any of these fails or the branch already exists, stop and tell me.

Follow AGENTS.md. This prompt already contains the spec text, API facts and kit facts for this task, copied from the repo.
To save credits:
- Edit only: frontend/src/app/admin/bookings/page.tsx (this page has no component file in my handout, so keep everything in it), and append to AI_PROMPTS.txt.
- Do NOT open docs/api/openapi.yaml, the .xlsx files, design-system/MASTER.md, frontend/README.md, or read AI_PROMPTS.txt. Everything needed is below.
- Open a kit file only if you need a prop not listed here. Read only the Next.js doc you need, only if unsure of an API.
- Pattern to copy for the server page: frontend/src/app/admin/accounts/page.tsx (requireUser(["admin"]), DashboardShell user + unreadNotifications from getUnreadCount(), PageHeader, async content inside <Suspense> with a Skeleton fallback, parsed searchParams (a Promise), backendJson, throw if null, metadata with title + robots index false). Format code normally, not as long one-line JSX.
- No new routes, libraries, tests, shared-file edits, inline styles or raw colors. If something is missing or contradicts the code, ask me one combined question before editing; don't explore widely or invent it.
- Don't run the dev server or browser tests (I will). Use only the git commands in the Branch and Commit steps. Never push, force, reset, stash or delete anything.
- Keep the header comment; remove only the TODO line (in each file you edit).

Global rules: loading, empty and error states; EmptyState when a list is empty; 10 per page with PaginationBar {page,totalPages,total,pageSize,hrefFor} keeping filters; works at 375px; Back/Cancel never loses unrelated data. A page past the last one shows an empty state with a link to page 1 [assumed]. The error page app/error.tsx already handles thrown errors.

Spec P-51 (read-only): reference, user, provider, dates, amount, status. Filters: type (flight or hotel), status, date range. No row actions.
Rendering: Dynamic SSR, server components only.

API: GET /api/admin/bookings?type&status&from&to&page. from/to are YYYY-MM-DD.
type: flight|hotel. status: pending_payment|confirmed|completed|expired|cancelled.
Returns {items,page,pageSize,total,totalPages}. Item: {id, type, reference (string|null), user:{id,name,email}, provider:{id,name,type}, dates:{from,to,startDate?,endDate?}, amount (integer cents), currency, status}.

Kit: DataTable: caption, rows, rowKey, columns[{header (unique), cell(row), align?: "end", hideOnMobile?}], empty={<EmptyState .../>}. Keep 2-3 columns visible on phones. EmptyState: title, line?, description?, action?, compact?. <Price cents={amount} currency={currency} size="sm" />. <StatusBadge kind="booking" status={status} />. formatDay("YYYY-MM-DD") from @/lib/dates.
Filters are a plain <form method="get"> (no client code needed) with kit FormField, Input type="date", the kit Select with a name (value "all" = no filter), an Apply button and a "Clear filters" link. Submitting drops page (back to 1). Ignore invalid values from the URL and never send empty parameters. The API returns 400 if from > to, and backendJson throws on 400: check this BEFORE fetching and show "From date must not be after to date" [assumed] under the To field, keeping the form values.

UI [assumed]: filters = Type, Status, From, To. Columns in the spec's order; User = name; Dates = startDate to endDate with formatDay (calendar dates only, because this API gives no airport time zone, so don't show flight clock times); missing reference shows "-". Option labels: Flight, Hotel, and the StatusBadge status words. Empty: "No bookings yet"; with filters "No bookings match these filters".

Finish: run once, in frontend/: npm run lint && npm run typecheck && npm run build. Fix errors in your files only.
Then append one entry to the END of AI_PROMPTS.txt with a shell append (don't read the file), exactly this layout:
================================================
Date: <today YYYY-MM-DD>
Student: Abdallah Mahmoud Abou Hussein
Tool: Codex
Related Requirement: ACC-17 (P-51 All bookings)

Prompt:
<short faithful summary of this prompt: read-only table and filters>

How the output was used:
<files built and which checks passed; don't claim browser testing>
================================================
Commit step: only if all three checks pass, git add the files you changed for this task by name (never git add -A), including AI_PROMPTS.txt, then git commit -m "feat(admin): build all bookings page (ACC-17)". Do not push.

Reply with only: branch name, files changed, check results, commit hash, any [assumed] choice, and a PR description following .github/pull_request_template.md (use "Part of #<issue>", leave browser-test and screenshot boxes unticked).
````

---

## 3. P-49 Create moderator

Branch: `feature/ACC-13-create-moderator-page`  
Commit: `feat(admin): build create moderator page (ACC-13)`

````text
Build P-49 Create moderator (/admin/moderators/new), requirement ACC-13.

Branch step (before any edit): run git status. If there are uncommitted changes, stop and tell me. Otherwise run git checkout develop && git pull origin develop && git checkout -b feature/ACC-13-create-moderator-page. If any of these fails or the branch already exists, stop and tell me.

Follow AGENTS.md. This prompt already contains the spec text, API facts and kit facts for this task, copied from the repo.
To save credits:
- Edit only: frontend/src/app/admin/moderators/new/page.tsx, plus one new client component frontend/src/components/app/admin/create-moderator-form.tsx (the stub list has no component for it; mention it in the PR), and append to AI_PROMPTS.txt.
- Do NOT open docs/api/openapi.yaml, the .xlsx files, design-system/MASTER.md, frontend/README.md, or read AI_PROMPTS.txt. Everything needed is below.
- Open a kit file only if you need a prop not listed here. Read only the Next.js doc you need, only if unsure of an API.
- Pattern to copy for the server page: frontend/src/app/admin/accounts/page.tsx (requireUser(["admin"]), DashboardShell user + unreadNotifications from getUnreadCount(), PageHeader, async content inside <Suspense> with a Skeleton fallback, parsed searchParams (a Promise), backendJson, throw if null, metadata with title + robots index false). Format code normally, not as long one-line JSX.
- No new routes, libraries, tests, shared-file edits, inline styles or raw colors. If something is missing or contradicts the code, ask me one combined question before editing; don't explore widely or invent it.
- Don't run the dev server or browser tests (I will). Use only the git commands in the Branch and Commit steps. Never push, force, reset, stash or delete anything.
- Keep the header comment; remove only the TODO line (in each file you edit).

Global rules: loading, empty and error states; EmptyState when a list is empty; 10 per page with PaginationBar {page,totalPages,total,pageSize,hrefFor} keeping filters; works at 375px; Back/Cancel never loses unrelated data. A page past the last one shows an empty state with a link to page 1 [assumed]. The error page app/error.tsx already handles thrown errors.

Spec P-49: name, email, role (hotel or airline moderator), linked to exactly one hotel or airline (select), and a temporary password. Password rule: at least 8 characters, 1 letter and 1 digit.
Rendering: Dynamic SSR + Client Components. The server page loads BOTH provider lists; the form is the client part.

API: GET /api/admin/providers?type=airline|hotel&page -> {items,totalPages,...}; item {id,name,code? (airline),cityId? (hotel),active,moderators:[]}. It returns 10 per page, so load every page with allPages from @/lib/all-pages:
allPages((p) => backendJson<{items: Provider[]; totalPages: number}>(`/api/admin/providers?type=airline&page=${p}`))
A provider may have several moderators.
POST /api/admin/moderators JSON {name (1-100), email, role: "airline_moderator"|"hotel_moderator", providerId, temporaryPassword} -> 201. Errors: 400 with fieldErrors; 404 "The airline or hotel does not exist."; 409 "The email is already registered."

Kit: every input in <FormField label name error required>; Input; Select; <PasswordInput showRules autoComplete="new-password" />; <FormErrorSummary errors labels message />; <Button loading>; toast from sonner. Client calls use apiFetch(path,{method:"POST",json}); on ApiError use fieldErrorMap(error.body) (from @/lib/api-error) and error.message. See ResetPasswordDialog in components/app/admin/accounts-table.tsx for this pattern.

UI [assumed]: role is chosen first; the provider select lists that role's providers by name and is disabled until then; changing role clears the chosen provider. Offer all providers the API returns. If the chosen type has none, say so under the select with a link to /admin/providers. Show 409 under Email. On success: toast "Moderator created.", clear the form, stay on the page. On error keep the typed values. Cancel links back to /admin.

Finish: run once, in frontend/: npm run lint && npm run typecheck && npm run build. Fix errors in your files only.
Then append one entry to the END of AI_PROMPTS.txt with a shell append (don't read the file), exactly this layout:
================================================
Date: <today YYYY-MM-DD>
Student: Abdallah Mahmoud Abou Hussein
Tool: Codex
Related Requirement: ACC-13 (P-49 Create moderator)

Prompt:
<short faithful summary of this prompt: form, provider loading, errors>

How the output was used:
<files built and which checks passed; don't claim browser testing>
================================================
Commit step: only if all three checks pass, git add the files you changed for this task by name (never git add -A), including AI_PROMPTS.txt, then git commit -m "feat(admin): build create moderator page (ACC-13)". Do not push.

Reply with only: branch name, files changed, check results, commit hash, any [assumed] choice, and a PR description following .github/pull_request_template.md (use "Part of #<issue>", leave browser-test and screenshot boxes unticked).
````

---

## 4. P-52 Reports

Branch: `feature/GEN-10-admin-reports-page`  
Commit: `feat(admin): build reports page (GEN-09, GEN-10)`

````text
Build P-52 Reports (/admin/reports), requirements GEN-09, GEN-10.

Branch step (before any edit): run git status. If there are uncommitted changes, stop and tell me. Otherwise run git checkout develop && git pull origin develop && git checkout -b feature/GEN-10-admin-reports-page. If any of these fails or the branch already exists, stop and tell me.

Follow AGENTS.md. This prompt already contains the spec text, API facts and kit facts for this task, copied from the repo.
To save credits:
- Edit only: frontend/src/app/admin/reports/page.tsx and frontend/src/components/app/admin/reports-list.tsx, and append to AI_PROMPTS.txt.
- Do NOT open docs/api/openapi.yaml, the .xlsx files, design-system/MASTER.md, frontend/README.md, or read AI_PROMPTS.txt. Everything needed is below.
- Open a kit file only if you need a prop not listed here. Read only the Next.js doc you need, only if unsure of an API.
- Pattern to copy for the server page: frontend/src/app/admin/accounts/page.tsx (requireUser(["admin"]), DashboardShell user + unreadNotifications from getUnreadCount(), PageHeader, async content inside <Suspense> with a Skeleton fallback, parsed searchParams (a Promise), backendJson, throw if null, metadata with title + robots index false). Format code normally, not as long one-line JSX.
- No new routes, libraries, tests, shared-file edits, inline styles or raw colors. If something is missing or contradicts the code, ask me one combined question before editing; don't explore widely or invent it.
- Don't run the dev server or browser tests (I will). Use only the git commands in the Branch and Commit steps. Never push, force, reset, stash or delete anything.
- Keep the header comment; remove only the TODO line (in each file you edit).

Global rules: loading, empty and error states; EmptyState when a list is empty; 10 per page with PaginationBar {page,totalPages,total,pageSize,hrefFor} keeping filters; works at 375px; Back/Cancel never loses unrelated data. A page past the last one shows an empty state with a link to page 1 [assumed]. The error page app/error.tsx already handles thrown errors.

Spec P-52: open reports list with content type, content preview, reason, reporter, date. Resolve: Dismiss, Hide content, Delete content (with confirmation). The spec also allows direct hide/unhide/delete from content pages; that is the existing shared AdminContentActions.
Rendering: Dynamic SSR + Client Components.

API: GET /api/admin/reports?status=open&page -> {items,page,pageSize,total,totalPages}; item {id, contentType: post|comment|review|itinerary, contentId, contentPreview? (may be missing), reporter:{id,name,email}, reason, status, createdAt}.
PATCH /api/admin/reports/{id} JSON {action: "dismiss"|"hide"|"delete", note?} -> 200. Also resolves other open reports on the same content. 404 "Report not found."; 409 "The report is already resolved."
Header endpoints for direct actions: DELETE /api/admin/content/{type}/{id}; PATCH .../hide {reason?}; PATCH .../unhide. The report item has no "hidden" flag.

Kit: ConfirmDialog {trigger,title,description,confirmLabel,tone?: "destructive"|"default",onConfirm}: it stays open if onConfirm throws, so toast.error the ApiError message and rethrow. Card, Button, EmptyState, PaginationBar, formatDate. Client calls use apiFetch; after success toast and router.refresh().

UI [assumed]: resolve through PATCH /api/admin/reports/{id} only; do NOT add AdminContentActions or call the content endpoints on this page (open reports have no hidden flag). No note field. Dismiss, Hide and Delete each use a ConfirmDialog (Hide and Delete use the destructive tone, Dismiss the default tone). Descriptions: dismiss "The report is closed and the content stays visible."; hide "Only the author and admins will see this content."; delete "The content is removed. This can't be undone." Type text in sentence case. Missing preview: "No preview available". Reporter shows name. On 409 also refresh the list. If the last item of a later page is resolved, the page-1 link must be available. Empty: "No open reports".

Finish: run once, in frontend/: npm run lint && npm run typecheck && npm run build. Fix errors in your files only.
Then append one entry to the END of AI_PROMPTS.txt with a shell append (don't read the file), exactly this layout:
================================================
Date: <today YYYY-MM-DD>
Student: Abdallah Mahmoud Abou Hussein
Tool: Codex
Related Requirement: GEN-09, GEN-10 (P-52 Reports)

Prompt:
<short faithful summary of this prompt: open reports list and resolve actions>

How the output was used:
<files built and which checks passed; don't claim browser testing>
================================================
Commit step: only if all three checks pass, git add the files you changed for this task by name (never git add -A), including AI_PROMPTS.txt, then git commit -m "feat(admin): build reports page (GEN-09, GEN-10)". Do not push.

Reply with only: branch name, files changed, check results, commit hash, any [assumed] choice, and a PR description following .github/pull_request_template.md (use "Part of #<issue>", leave browser-test and screenshot boxes unticked).
````

---

## 5. P-50 Providers

Branch: `feature/ACC-15-admin-providers-page`  
Commit: `feat(admin): build providers page (ACC-15, FLT-01, HTL-01, GEN-12)`

````text
Build P-50 Providers (/admin/providers), requirements ACC-15, FLT-01, HTL-01, GEN-12.

Branch step (before any edit): run git status. If there are uncommitted changes, stop and tell me. Otherwise run git checkout develop && git pull origin develop && git checkout -b feature/ACC-15-admin-providers-page. If any of these fails or the branch already exists, stop and tell me.

Follow AGENTS.md. This prompt already contains the spec text, API facts and kit facts for this task, copied from the repo.
To save credits:
- Edit only: frontend/src/app/admin/providers/page.tsx and frontend/src/components/app/admin/providers-table.tsx, and append to AI_PROMPTS.txt.
- Do NOT open docs/api/openapi.yaml, the .xlsx files, design-system/MASTER.md, frontend/README.md, or read AI_PROMPTS.txt. Everything needed is below.
- Open a kit file only if you need a prop not listed here. Read only the Next.js doc you need, only if unsure of an API.
- Pattern to copy for the server page: frontend/src/app/admin/accounts/page.tsx (requireUser(["admin"]), DashboardShell user + unreadNotifications from getUnreadCount(), PageHeader, async content inside <Suspense> with a Skeleton fallback, parsed searchParams (a Promise), backendJson, throw if null, metadata with title + robots index false). Format code normally, not as long one-line JSX.
- No new routes, libraries, tests, shared-file edits, inline styles or raw colors. If something is missing or contradicts the code, ask me one combined question before editing; don't explore widely or invent it.
- Don't run the dev server or browser tests (I will). Use only the git commands in the Branch and Commit steps. Never push, force, reset, stash or delete anything.
- Keep the header comment; remove only the TODO line (in each file you edit).

Global rules: loading, empty and error states; EmptyState when a list is empty; 10 per page with PaginationBar {page,totalPages,total,pageSize,hrefFor} keeping filters; works at 375px; Back/Cancel never loses unrelated data. A page past the last one shows an empty state with a link to page 1 [assumed]. The error page app/error.tsx already handles thrown errors.

Spec P-50: airlines and hotels; create airline and create hotel; Deactivate/Reactivate with a confirmation dialog explaining that the provider is hidden from search and can't be booked, existing Confirmed bookings stay valid, and affected parties are notified. Countries and cities come from the predefined lists (GEN-12). Images: JPG/PNG, <=5 MB, 1 airline logo, <=5 hotel photos (GEN-08).
Rendering: Dynamic SSR + Client Components.

API:
- GET /api/admin/providers?type=airline|hotel (required)&search&active=true|false&page -> paginated; item {id,type,name,code?,logoUrl?,cityId?,countryCode?,photoUrl?,active,moderators:[{id,name,email}]}.
- PATCH /api/admin/providers/{type}/{id}/deactivate and /reactivate (no body needed). 404, or 409 if already in that state.
- POST /api/airlines, multipart: name (1-100), code (2-3 letters/digits, backend uppercases), logo? (file). 400 invalid; 409 "Another airline already uses this code."
- POST /api/hotels, multipart: name (1-100), address (1-200), cityId, countryCode, description (1-2000), starRating (integer 1-5), amenities (repeat the field once per item, each <=50), photos (repeat the field, <=5). City must belong to the country.
- GET /api/countries?page -> items {code,name}. GET /api/cities?country=XX&page -> items {cityId,name,countryCode}. Both are paginated: load all pages with allPages from @/lib/all-pages. /api/cities is not in the header's endpoint list but spec section 9 assigns it to the hotel forms and cityId requires it [assumed]; add "GET /api/cities" to the page header's Endpoints line (the one other header change allowed).

Kit: DataTable: caption, rows, rowKey, columns[{header (unique), cell(row), align?: "end", hideOnMobile?}], empty={<EmptyState .../>}. Keep 2-3 columns visible on phones. EmptyState: title, line?, description?, action?, compact?. <StatusBadge kind="provider" status={active ? "active" : "inactive"} />. ConfirmDialog {trigger,title,description,confirmLabel,tone,onConfirm}; on failure toast.error and rethrow. Dialog, FormField, FormErrorSummary, Input, Textarea, Select, TagInput {value,onChange,max,maxLength} (its default max is 5 and maxLength 30!). ImageUploader {max,noun,existing:[{id,url}],onAdd(files),onRemove(id)}: in create forms it does not keep files itself, so store the Files in state, pass them as existing with object URLs, and revoke the URLs on removal/unmount. Send uploads with apiFetch(path,{method:"POST",body:formData}) (don't set content-type). Errors: fieldErrorMap(error.body) from @/lib/api-error, plus error.message. After success toast and router.refresh().

UI [assumed]: Airlines | Hotels switch through ?type (default airline); search by name/code and a status filter (All, Active, Deactivated) kept in the URL as a GET form. Columns: Name; Code (airlines) or Location (hotels: city and country names); Status; Moderators (names, or "None"); Actions. No images in the table. "Create airline" and "Create hotel" buttons each open a Dialog (scrollable on phones); cancel closes it without changing the list. Changing country clears the city. Amenities: TagInput max 20, maxLength 50. Star rating: Select 1-5. Photos and logo are optional. Show the airline 409 under Code. Keep typed values when a request fails. Empty: "No airlines yet" / "No hotels yet"; with filters "No providers match these filters".

Finish: run once, in frontend/: npm run lint && npm run typecheck && npm run build. Fix errors in your files only.
Then append one entry to the END of AI_PROMPTS.txt with a shell append (don't read the file), exactly this layout:
================================================
Date: <today YYYY-MM-DD>
Student: Abdallah Mahmoud Abou Hussein
Tool: Codex
Related Requirement: ACC-15, FLT-01, HTL-01, GEN-12 (P-50 Providers)

Prompt:
<short faithful summary of this prompt: table, create forms, activate/deactivate>

How the output was used:
<files built and which checks passed; don't claim browser testing>
================================================
Commit step: only if all three checks pass, git add the files you changed for this task by name (never git add -A), including AI_PROMPTS.txt, then git commit -m "feat(admin): build providers page (ACC-15, FLT-01, HTL-01, GEN-12)". Do not push.

Reply with only: branch name, files changed, check results, commit hash, any [assumed] choice, and a PR description following .github/pull_request_template.md (use "Part of #<issue>", leave browser-test and screenshot boxes unticked).
````

---

## 6. Analytics (BONUS, do last)

Branch: `feature/BON-01-admin-analytics-page`  
Commit: `feat(admin): build analytics page (BON-01)`

````text
Build the bonus Admin analytics page (/admin/analytics), requirement BON-01.

Branch step (before any edit): run git status. If there are uncommitted changes, stop and tell me. Otherwise run git checkout develop && git pull origin develop && git checkout -b feature/BON-01-admin-analytics-page. If any of these fails or the branch already exists, stop and tell me.

Follow AGENTS.md. This prompt already contains the spec text, API facts and kit facts for this task, copied from the repo.
To save credits:
- Edit only: frontend/src/app/admin/analytics/page.tsx and frontend/src/components/app/admin/analytics-charts.tsx, and append to AI_PROMPTS.txt.
- Do NOT open docs/api/openapi.yaml, the .xlsx files, design-system/MASTER.md, frontend/README.md, or read AI_PROMPTS.txt. Everything needed is below.
- Open a kit file only if you need a prop not listed here. Read only the Next.js doc you need, only if unsure of an API.
- Pattern to copy for the server page: frontend/src/app/admin/accounts/page.tsx (requireUser(["admin"]), DashboardShell user + unreadNotifications from getUnreadCount(), PageHeader, async content inside <Suspense> with a Skeleton fallback, parsed searchParams (a Promise), backendJson, throw if null, metadata with title + robots index false). Format code normally, not as long one-line JSX.
- No new routes, libraries, tests, shared-file edits, inline styles or raw colors. If something is missing or contradicts the code, ask me one combined question before editing; don't explore widely or invent it.
- Don't run the dev server or browser tests (I will). Use only the git commands in the Branch and Commit steps. Never push, force, reset, stash or delete anything.
- Keep the header comment; remove only the TODO line (in each file you edit).

Global rules: loading, empty and error states; EmptyState when a list is empty; 10 per page with PaginationBar {page,totalPages,total,pageSize,hrefFor} keeping filters; works at 375px; Back/Cancel never loses unrelated data. A page past the last one shows an empty state with a link to page 1 [assumed]. The error page app/error.tsx already handles thrown errors.

Spec: bookings and revenue per provider over a period. Design decision D12: bar charts, always with a table alternative.
Rendering: Dynamic SSR. analytics-charts.tsx is a client component ("use client") because BarChart is one: pass it plain data and the currency, never functions from the server.

API: GET /api/admin/analytics?type=airline|hotel&from&to&page. from/to are YYYY-MM-DD. (It also accepts providerId, status, dateBy.)
Returns {summary, items, page, pageSize, total, totalPages}.
summary {totalBookings,confirmedBookings,completedBookings,cancelledBookings,pendingBookings,totalRevenue (integer cents),currency}.
item {providerId,providerName,providerType,totalBookings,confirmedBookings,completedBookings,cancelledBookings,pendingBookings,totalRevenue (cents),currency}. 10 items per page. There is no time-series data, so no line chart.

Kit: <BarChart title summary? data={[{label,value}]} format? /> already has "Show as table"; it uses label as the React key, so labels must be unique (add the provider type or id if names repeat). StatCard {label,value (number|string)}. formatCents(cents,currency) from @/lib/format. PaginationBar, EmptyState.
Filters are a plain <form method="get"> (no client code needed) with kit FormField, Input type="date", the kit Select with a name (value "all" = no filter), an Apply button and a "Clear filters" link. Submitting drops page (back to 1). Ignore invalid values from the URL and never send empty parameters. The API returns 400 if from > to, and backendJson throws on 400: check this BEFORE fetching and show "From date must not be after to date" [assumed] under the To field, keeping the form values.

UI [assumed]: filters = Provider type, From, To only (backend defaults for the rest). Stat cards: Total bookings, Confirmed, Completed, Cancelled, Pending, Revenue. Two charts: "Bookings per provider" and "Revenue per provider", for the providers on the current page; say so in each chart summary when totalPages > 1. Revenue is formatted from cents with formatCents. Empty: "No analytics for this period".

Finish: run once, in frontend/: npm run lint && npm run typecheck && npm run build. Fix errors in your files only.
Then append one entry to the END of AI_PROMPTS.txt with a shell append (don't read the file), exactly this layout:
================================================
Date: <today YYYY-MM-DD>
Student: Abdallah Mahmoud Abou Hussein
Tool: Codex
Related Requirement: BON-01 (Admin analytics)

Prompt:
<short faithful summary of this prompt: summary cards, charts, filters>

How the output was used:
<files built and which checks passed; don't claim browser testing>
================================================
Commit step: only if all three checks pass, git add the files you changed for this task by name (never git add -A), including AI_PROMPTS.txt, then git commit -m "feat(admin): build analytics page (BON-01)". Do not push.

Reply with only: branch name, files changed, check results, commit hash, any [assumed] choice, and a PR description following .github/pull_request_template.md (use "Part of #<issue>", leave browser-test and screenshot boxes unticked).
````
