import { IsEnum, IsMongoId, IsOptional, Matches } from 'class-validator';
import { BookingType } from '../../common/enums';

// Area: Payments & Refunds
// Used by: POST /api/payments (body), openapi.yaml "PaymentRequest"
// Requirements: PAY-01

export class CreatePaymentDto {
  @IsEnum(BookingType, { message: 'bookingType must be "flight" or "hotel"' })
  bookingType: BookingType;

  @IsMongoId({ message: 'bookingId must be a valid id' })
  bookingId: string;

  // For testing from Swagger only: a Stripe test payment method such as pm_card_visa
  // (succeeds) or pm_card_chargeDeclined (fails). The frontend leaves it out and confirms the
  // payment with Stripe Elements using the returned clientSecret.
  @IsOptional()
  @Matches(/^pm_\w+$/, {
    message: 'paymentMethodId must be a Stripe payment method id (pm_...)',
  })
  paymentMethodId?: string;
}
