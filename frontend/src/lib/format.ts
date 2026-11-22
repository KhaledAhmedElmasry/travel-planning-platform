// Formatting helpers used by the kit components. Pages should use the components
// (<Price>, <BudgetAmount>, <LocalTime>) instead of calling these directly.

/**
 * Booking money from the backend is an integer number of cents in the platform
 * currency (PAY-04, openapi). 12000 + "USD" -> "$120.00".
 */
export function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(cents / 100);
}

/**
 * Itinerary budgets are decimals in any supported currency (ITN-14, ITN-18).
 * 1234.5 + "EGP" -> "EGP 1,234.50".
 */
export function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "code",
  }).format(amount);
}

/**
 * A moment stored in UTC shown in an airport's own time zone (GEN-06, FLT-17).
 * ("2027-03-01T06:40:00Z", "Africa/Cairo") -> { time: "08:40", date: "Mon, 1 Mar", zone: "GMT+2" }
 */
export function formatLocal(iso: string, timeZone: string) {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
  const zone =
    new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "shortOffset" })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? timeZone;
  return { time, date: day, zone };
}

/** "2026-11-12T10:00:00Z" -> "12 Nov 2026" (dates in lists and tables). */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/** 754 seconds -> "12:34" (hold countdown). */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
