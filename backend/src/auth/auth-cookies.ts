import type { CookieOptions, Response } from 'express';

// Area: Auth & Accounts
// The two auth cookies (ACC-19). Tokens are never sent in a response body, so JavaScript
// in the browser can never read them.

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

// The access token is short-lived (ACC-19).
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
// A session with no activity for 30 minutes expires (ACC-06, ACC-19). Checked on the server with
// the session's expiresAt, which moves forward with every authenticated request and refresh.
export const SESSION_IDLE_SECONDS = 30 * 60;
// ACC-19: the refresh token (and its cookie) is an upper limit only. Whether it still works is
// decided by the session's 30-minute idle expiry, so an active user is never cut off early.
export const REFRESH_TOKEN_TTL_SECONDS = 24 * 60 * 60;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// httpOnly: not readable from JavaScript. Secure: HTTPS only (browsers also accept it on
// http://localhost). SameSite strict: not sent with requests from other sites.
const BASE: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
};

// Milestone 2 (same-origin frontend): the Next.js app serves the pages and forwards /api to this
// backend, so the browser sees one origin. The access cookie uses path '/' so it also comes with
// page requests (/bookings, /admin/...): server-rendered pages read it to know who is logged in.
// It is still httpOnly + SameSite strict, so no script and no other site can use it.
export const ACCESS_COOKIE_PATH = '/';
// The refresh token stays narrow: only refresh and logout ever need it.
export const REFRESH_COOKIE_PATH = '/api/auth';
// Path used before Milestone 2; logout also clears it so an old cookie can't linger.
const LEGACY_ACCESS_COOKIE_PATH = '/api';

export function setAuthCookies(res: Response, tokens: AuthTokens): void {
  // A browser that logged in before Milestone 2 may still hold an access cookie on '/api'; with
  // two cookies of the same name it could send the stale one first. Remove it. This comes FIRST:
  // clients that track cookies by name only would otherwise drop the new token right after it.
  res.clearCookie(ACCESS_COOKIE, { ...BASE, path: LEGACY_ACCESS_COOKIE_PATH });
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...BASE,
    path: ACCESS_COOKIE_PATH,
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  // Only sent to /api/auth/* (refresh and logout), not with every request.
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...BASE,
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

// ACC-06: logout. The options must match the ones the cookies were set with, or the browser keeps
// them.
export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...BASE, path: LEGACY_ACCESS_COOKIE_PATH });
  res.clearCookie(ACCESS_COOKIE, { ...BASE, path: ACCESS_COOKIE_PATH });
  res.clearCookie(REFRESH_COOKIE, { ...BASE, path: REFRESH_COOKIE_PATH });
}
