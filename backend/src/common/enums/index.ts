// Shared enums (roles, statuses, cabin classes, ...) used by several modules.
// Add values here instead of repeating string literals in each module.

// The ":type" of a booking in URLs and payments (openapi.yaml "BookingType").
export enum BookingType {
  Flight = 'flight',
  Hotel = 'hotel',
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
