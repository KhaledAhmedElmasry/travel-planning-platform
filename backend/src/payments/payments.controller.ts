import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  type RawBodyRequest,
  Req,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RetryPaymentDto } from './dto/retry-payment.dto';
import { PaymentResponse, PaymentsService } from './payments.service';

// Area: Payments & Refunds
// Requirements: PAY-01, PAY-02, PAY-03, PAY-04, NEW-04
// Endpoints to implement (PDF section 8):
//   GET  /api/bookings/:type/:id/policies          PAY-02   TODO
//   POST /api/bookings/:type/:id/accept-policies   PAY-02   TODO
//   POST /api/payments                             PAY-01   done
//   POST /api/payments/:id/retry                   PAY-01   done
//   GET  /api/payments/:id                         PAY-01   done
//   POST /api/payments/webhook                     PAY-01   done
//   GET  /api/refunds/:id                          PAY-03   TODO
// Notes:
//   :type is "flight" or "hotel". Payment is blocked until the policies are accepted (PAY-02).
//   The webhook is public and needs the raw request body to verify Stripe's signature
//   (rawBody: true in main.ts).
//   Never store card data: only the Stripe payment id, amount, currency and status (PAY-01).
//
// WAITING FOR (Area 2, ACC-04 / ACC-11 / ACC-19): JwtAuthGuard and @CurrentUser().
//   Until they exist, currentUserId() below finds no logged-in user and the three user
//   endpoints answer 401. When they are merged:
//     1. add @UseGuards(JwtAuthGuard) to createPayment, retryPayment and getPayment (or a global
//        guard + @Public() on handleWebhook, which Stripe calls without a login);
//     2. replace currentUserId(req) with the @CurrentUser() decorator and delete the helper.
// WAITING FOR (Area 3, GEN-02 / GEN-13): the global ValidationPipe in main.ts. Then remove the
//   local `new ValidationPipe(...)` from the @Body() parameters below.
@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // PAY-01: create a Stripe PaymentIntent for a pending_payment booking.
  @Post('payments')
  createPayment(
    @Req() req: Request,
    @Body(new ValidationPipe({ whitelist: true })) dto: CreatePaymentDto,
  ): Promise<PaymentResponse> {
    return this.paymentsService.createPayment(currentUserId(req), dto);
  }

  // PAY-01: called by Stripe only. Must stay public (no login guard).
  @Post('payments/webhook')
  @HttpCode(HttpStatus.OK)
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ): Promise<{ received: true }> {
    return this.paymentsService.handleWebhook(req.rawBody, signature);
  }

  // PAY-01: retry a failed payment while the hold is still valid.
  @Post('payments/:id/retry')
  retryPayment(
    @Req() req: Request,
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true })) dto: RetryPaymentDto,
  ): Promise<PaymentResponse> {
    return this.paymentsService.retryPayment(currentUserId(req), id, dto ?? {});
  }

  // PAY-01: payment status for the user who made it.
  @Get('payments/:id')
  getPayment(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<PaymentResponse> {
    return this.paymentsService.getPayment(currentUserId(req), id);
  }

  // TODO(PAY-02): GET /api/bookings/:type/:id/policies, POST /api/bookings/:type/:id/accept-policies
  // TODO(PAY-03): GET /api/refunds/:id
}

// Temporary until Area 2 adds @CurrentUser() (see WAITING FOR above). Expects the auth guard to
// put the logged-in user on req.user with an `id` string; adjust if Area 2 names it differently.
function currentUserId(req: Request): string {
  const user = (req as Request & { user?: { id?: string } }).user;
  if (!user?.id) {
    throw new UnauthorizedException('You must be logged in.');
  }
  return user.id;
}
