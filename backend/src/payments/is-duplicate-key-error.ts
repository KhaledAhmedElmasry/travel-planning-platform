// Area: Payments & Refunds
// MongoDB error 11000: an insert broke a unique index (e.g. a second payment or refund for the
// same booking created at the same moment).
export function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}
