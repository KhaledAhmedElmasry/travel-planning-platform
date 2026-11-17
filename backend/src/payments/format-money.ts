// Amounts are stored in cents (PAY-04). Shown as "1234.50 USD" in the e-ticket (FLT-23) and in
// the in-app notifications (GEN-01).
export function formatMoney(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}
