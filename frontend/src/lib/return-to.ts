// "Return to where you were" after login (ACC-10), without an open redirect:
// only paths on this site are accepted ("/bookings?tab=past"), never "https://evil.com" or "//evil.com".
import { HOME_FOR_ROLE } from "@/lib/nav";
import type { Role } from "@/lib/session";

/** Request header set by src/proxy.ts with the path being rendered. */
export const CURRENT_PATH_HEADER = "x-yallaway-path";

const NEVER_RETURN_TO = ["/login", "/signup", "/resume-session", "/logout"];

/** A safe local path, or null. */
export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/[\u0000-\u001f]/.test(value)) return null;
  if (NEVER_RETURN_TO.some((p) => value === p || value.startsWith(`${p}?`) || value.startsWith(`${p}/`))) return null;
  return value;
}

/** Where to go right after login: back to the action (ACC-10), else the role's home page (ACC-04). */
export function afterLoginPath(role: Role, returnTo: string | null | undefined): string {
  return safeReturnTo(returnTo) ?? HOME_FOR_ROLE[role];
}

/** "/login?returnTo=%2Fbookings" */
export function loginPath(returnTo?: string | null): string {
  const safe = safeReturnTo(returnTo);
  return safe ? `/login?returnTo=${encodeURIComponent(safe)}` : "/login";
}
