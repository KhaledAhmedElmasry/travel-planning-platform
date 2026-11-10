import { IsIn, IsMongoId, IsOptional, Matches } from 'class-validator';

// Area: Payments, Holds & Booking Engine
// Used by: PATCH /api/flight-bookings/:id/change-flight (body)
// Requirements: FLT-27 (bonus)
export class ChangeFlightDto {
  @IsIn(['outbound', 'return'], {
    message: 'segment must be outbound or return',
  })
  segment: 'outbound' | 'return';

  @IsMongoId({ message: 'newFlightId must be a valid id' })
  newFlightId: string;

  // Needed only when the new flight costs more: the fare difference is paid with it (a Stripe
  // test payment method such as pm_card_visa in Swagger, like POST /api/payments).
  @IsOptional()
  @Matches(/^pm_\w+$/, {
    message: 'paymentMethodId must be a Stripe payment method id (pm_...)',
  })
  paymentMethodId?: string;
}
