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
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

// ACC-06: logout. The options must match the ones the cookies were set with, or the browser keeps
// them.
export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...BASE, path: '/api' });
  res.clearCookie(REFRESH_COOKIE, { ...BASE, path: '/api/auth' });
}
