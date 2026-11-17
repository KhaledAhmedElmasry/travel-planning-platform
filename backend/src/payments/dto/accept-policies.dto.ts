import { Equals } from 'class-validator';

// Area: Payments & Refunds
// Used by: POST /api/bookings/:type/:id/accept-policies (body), openapi.yaml "AcceptPoliciesRequest"
// Requirements: PAY-02

export class AcceptPoliciesDto {
  // The acceptance checkbox. Anything other than true (false, "true", missing) is refused.
  @Equals(true, { message: 'accepted must be true' })
  accepted: boolean;
}
