// Shared enums (roles, statuses, cabin classes, ...) used by several modules.
// Add values here instead of repeating string literals in each module.

// Account roles (PDF section 4), openapi.yaml "Role". Registration always creates Role.User;
// admins are seeded (ACC-18) and moderators are created by an admin (ACC-13).
export enum Role {
  User = 'user',
  Admin = 'admin',
  AirlineModerator = 'airline_moderator',
  HotelModerator = 'hotel_moderator',
}

// Account status, openapi.yaml "AccountStatus" (ACC-03, ACC-12, ACC-15, ACC-16).
export enum AccountStatus {
  Active = 'active',
  Suspended = 'suspended',
  Deactivated = 'deactivated',
}

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
