// Shared enums (roles, statuses, cabin classes, ...) used by several modules.
// Add values here instead of repeating string literals in each module.

// The ":type" of a booking in URLs and payments (openapi.yaml "BookingType").
export enum BookingType {
  Flight = 'flight',
  Hotel = 'hotel',
}

// Fixed set of cabin categories (FLT-04), openapi.yaml "CabinClass".
export enum CabinClass {
  Economy = 'economy',
  PremiumEconomy = 'premium_economy',
  Business = 'business',
  First = 'first',
}

// Passenger types (FLT-12): adult 12+, child 2-11, infant under 2.
export enum PassengerType {
  Adult = 'adult',
  Child = 'child',
  Infant = 'infant',
}

// Booking lifecycle (GEN-11). The only transitions are pending_payment -> confirmed -> completed,
// pending_payment -> expired, and confirmed -> cancelled.
export enum BookingStatus {
  PendingPayment = 'pending_payment',
  Confirmed = 'confirmed',
  Completed = 'completed',
  Expired = 'expired',
  Cancelled = 'cancelled',
}
