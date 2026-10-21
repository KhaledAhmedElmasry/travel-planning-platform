import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';

// Owner: Member 1 (Team leader)
// Requirements: PAY-01, PAY-02, PAY-03, PAY-04, NEW-04
// Endpoints to implement (PDF section 8):
//   GET  /api/bookings/:type/:id/policies          PAY-02
//   POST /api/bookings/:type/:id/accept-policies   PAY-02
//   POST /api/payments                             PAY-01
//   POST /api/payments/:id/retry                   PAY-01
//   GET  /api/payments/:id                         PAY-01
//   POST /api/payments/webhook                     PAY-01
//   GET  /api/refunds/:id                          PAY-03
@ApiTags('Payments')
@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // TODO: add the endpoints listed above.
}
