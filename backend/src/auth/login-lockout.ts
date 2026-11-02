// Area: Auth & Accounts
// ACC-05: after 5 consecutive failed logins the account is locked for 15 minutes. A successful
// login resets the counter. Locking also resets it, so after the lock the account gets 5 new tries.

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
export const LOCK_DURATION_MS = LOCK_MINUTES * 60 * 1000;

export function isLocked(
  lockUntil: Date | null | undefined,
  now = new Date(),
): lockUntil is Date {
  return !!lockUntil && lockUntil.getTime() > now.getTime();
}

// The lockout message, with the minutes left rounded up (never "0 minutes").
export function lockedMessage(lockUntil: Date, now = new Date()): string {
  const minutes = Math.max(
    1,
    Math.ceil((lockUntil.getTime() - now.getTime()) / 60_000),
  );
  return `Account locked after ${MAX_FAILED_LOGINS} failed login attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}`;
}
