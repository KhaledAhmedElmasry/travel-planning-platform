import type { CookieOptions, Response } from 'express';

// Area: Auth & Accounts
// The two auth cookies (ACC-19, NEW-07). Tokens are never sent in a response body, so JavaScript
// in the browser can never read them.

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

// The access token is short-lived (NEW-07).
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
// A session with no activity for 30 minutes expires (ACC-06, NEW-07).
export const SESSION_IDLE_SECONDS = 30 * 60;

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

export function setAuthCookies(res: Response, tokens: AuthTokens): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...BASE,
    path: '/api',
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  // Only sent to /api/auth/* (refresh and logout), not with every request.
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...BASE,
    path: '/api/auth',
    maxAge: SESSION_IDLE_SECONDS * 1000,
  });
}

// ACC-06: logout. The options must match the ones the cookies were set with, or the browser keeps
// them.
export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...BASE, path: '/api' });
  res.clearCookie(REFRESH_COOKIE, { ...BASE, path: '/api/auth' });
}
