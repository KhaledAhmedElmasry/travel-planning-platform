# Frontend (Milestone 2)

The Next.js frontend is built in Milestone 2 (deadline 11/12). It is not part of Milestone 1.

## Requirements Done Only in the Frontend

These mandatory requirements have no backend work (or only the small backend part noted):

| Requirement | What the frontend must do |
|---|---|
| ACC-10 | Send a guest who tries a restricted action to login, then back to that action (backend returns 401). |
| GEN-02 | Show the backend's field-level validation messages next to each form field. |
| GEN-03 | Ask for confirmation before destructive actions (delete, cancel). |
| GEN-04 | Show friendly empty states when a list or search has no results (backend returns an empty page). |
| GEN-14 | Clear information architecture and navigation; users can go back or cancel without losing data. |
| GEN-15 | Intuitive, easy-to-learn interface with clearly visible actions. |
| GEN-16 | Loading, success and error states; responsive on desktop, tablet and mobile. |
| GEN-17 | Consistent colours, typography, spacing and component styling. |

See the rendering strategy table in section 9 of the project description (ISR / SSR / Client Components per page).

## Sessions and Tokens (ACC-19)

The backend already does its part: `POST /api/auth/login` sets the `access_token` and
`refresh_token` cookies as httpOnly, Secure, SameSite=Strict, tokens are never in a response body,
and every auth and profile response has `Cache-Control: no-store`. The frontend must keep it that
way:

| Do | Never |
|---|---|
| Send every API call with the cookies: `fetch(url, { credentials: 'include' })` (or `withCredentials: true` in axios). | Store a token, a password or the user object in `localStorage`, `sessionStorage`, IndexedDB or a non-httpOnly cookie. |
| Get the logged-in account from `GET /api/auth/me` when the app loads and keep it only in memory (React state or context). | Read `document.cookie` for auth, or put a token in a URL, a header you build yourself, or a log. |
| Treat **401** as "not logged in": clear the in-memory user and go to login (then back to the action, ACC-10). | Cache `/api/auth/me` or `/api/users/me` responses yourself (for example with ISR or a service worker). |
| Log out with `POST /api/auth/logout`; it revokes the session and clears both cookies. | Keep the password field's value after the login request. |
| If `mustChangePassword` is true in `/auth/me`, send the user to the change-password page (ACC-07a, ACC-13). | |

The cookies are `Secure`: Chrome and Edge accept them on `http://localhost`, Safari does not. When the
frontend runs on another origin (for example `http://localhost:3001`), the backend needs CORS with
`credentials: true` and `origin: FRONTEND_URL`, still a TODO in `backend/src/main.ts` for
Milestone 2.
