import { IsOptional, Matches } from 'class-validator';

// Area: Payments & Refunds
// Used by: POST /api/payments/:id/retry (body, optional), openapi.yaml "RetryPaymentRequest"
// Requirements: PAY-01

export class RetryPaymentDto {
  // For testing from Swagger only, as in CreatePaymentDto.
  @IsOptional()
  @Matches(/^pm_\w+$/, {
    message: 'paymentMethodId must be a Stripe payment method id (pm_...)',
  })
  paymentMethodId?: string;
}
