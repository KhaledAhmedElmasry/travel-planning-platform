import { Controller } from '@nestjs/common';
import { PaymentsService } from './payments.service';

// Area: Payments & Refunds
// Requirements: PAY-01, PAY-02, PAY-03, PAY-04, NEW-04
// Endpoints to implement (PDF section 8):
//   GET  /api/bookings/:type/:id/policies          PAY-02
//   POST /api/bookings/:type/:id/accept-policies   PAY-02
//   POST /api/payments                             PAY-01
//   POST /api/payments/:id/retry                   PAY-01
//   GET  /api/payments/:id                         PAY-01
//   POST /api/payments/webhook                     PAY-01
//   GET  /api/refunds/:id                          PAY-03
// Notes:
//   :type is "flight" or "hotel". Payment is blocked until the policies are accepted (PAY-02).
//   The webhook is public and needs the raw request body to verify Stripe's signature.
//   Never store card data: only the Stripe payment id, amount, currency and status (PAY-01).
@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // TODO: add the endpoints listed above.
}
