import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Post,
  type RawBodyRequest,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators';
import { BookingType } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import type { AuthUser } from '../common/interfaces';
import { AcceptPoliciesDto } from './dto/accept-policies.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RetryPaymentDto } from './dto/retry-payment.dto';
import { PaymentResponse, PaymentsService } from './payments.service';
import {
  AcceptPoliciesResponse,
  PoliciesResponse,
  PoliciesService,
} from './policies.service';
import { RefundResponse, RefundsService } from './refunds.service';
import { RegisteredUserGuard } from './registered-user.guard';

// Area: Payments & Refunds
// Requirements: PAY-01, PAY-02, PAY-03, PAY-04, NEW-04
// Endpoints to implement (PDF section 8):
//   GET  /api/bookings/:type/:id/policies          PAY-02   done
//   POST /api/bookings/:type/:id/accept-policies   PAY-02   done
//   POST /api/payments                             PAY-01   done
//   POST /api/payments/:id/retry                   PAY-01   done
//   GET  /api/payments/:id                         PAY-01   done
//   POST /api/payments/webhook                     PAY-01   done
//   GET  /api/refunds/:id                          PAY-03   done
// Notes:
//   :type is "flight" or "hotel". Payment is blocked until the policies are accepted (PAY-02).
//   The webhook is public and needs the raw request body to verify Stripe's signature
//   (rawBody: true in main.ts).
//   Never store card data: only the Stripe payment id, amount, currency and status (PAY-01).
//
//   Every route except the webhook needs a login (401 for guests, JwtAuthGuard, ACC-04) and the
//   role `user` (403 for admins and moderators, RegisteredUserGuard): PAY-01 and PAY-02 are
//   Registered User actions. The guards are on each route, not on the class, because Stripe calls
//   the webhook without a login.
// WAITING FOR (Area 3, GEN-02 / GEN-13): the global ValidationPipe in main.ts. Then remove the
//   local `new ValidationPipe(...)` from the @Body() parameters below.
@Controller()
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly policiesService: PoliciesService,
    private readonly refundsService: RefundsService,
  ) {}

  // PAY-02: the provider policies to accept before paying, and acceptedAt if already accepted.
  @Get('bookings/:type/:id/policies')
  @UseGuards(JwtAuthGuard, RegisteredUserGuard)
  getPolicies(
    @CurrentUser() user: AuthUser,
    @Param('type', bookingTypePipe()) type: BookingType,
    @Param('id') id: string,
  ): Promise<PoliciesResponse> {
    return this.policiesService.getPolicies(user.id, type, id);
  }

  // PAY-02: accept the policies; stored with a timestamp on the booking.
  @Post('bookings/:type/:id/accept-policies')
  @UseGuards(JwtAuthGuard, RegisteredUserGuard)
  @HttpCode(HttpStatus.OK)
  acceptPolicies(
    @CurrentUser() user: AuthUser,
    @Param('type', bookingTypePipe()) type: BookingType,
    @Param('id') id: string,
    // Validated only (accepted must be true); the value itself is not needed.
    @Body(new ValidationPipe({ whitelist: true })) _dto: AcceptPoliciesDto,
  ): Promise<AcceptPoliciesResponse> {
    return this.policiesService.acceptPolicies(user.id, type, id);
  }

  // PAY-01: create a Stripe PaymentIntent for a pending_payment booking.
  @Post('payments')
  @UseGuards(JwtAuthGuard, RegisteredUserGuard)
  createPayment(
    @CurrentUser() user: AuthUser,
    @Body(new ValidationPipe({ whitelist: true })) dto: CreatePaymentDto,
  ): Promise<PaymentResponse> {
    return this.paymentsService.createPayment(user.id, dto);
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
  @UseGuards(JwtAuthGuard, RegisteredUserGuard)
  retryPayment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true })) dto: RetryPaymentDto,
  ): Promise<PaymentResponse> {
    return this.paymentsService.retryPayment(user.id, id, dto ?? {});
  }

  // PAY-01: payment status for the user who made it.
  @Get('payments/:id')
  @UseGuards(JwtAuthGuard, RegisteredUserGuard)
  getPayment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<PaymentResponse> {
    return this.paymentsService.getPayment(user.id, id);
  }

  // PAY-03: a refund and its status (pending, refunded, failed) for the owner of the booking.
  @Get('refunds/:id')
  @UseGuards(JwtAuthGuard, RegisteredUserGuard)
  getRefund(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<RefundResponse> {
    return this.refundsService.getRefund(user.id, id);
  }
}

// :type must be "flight" or "hotel"; anything else answers 400.
function bookingTypePipe() {
  return new ParseEnumPipe(BookingType, {
    exceptionFactory: () =>
      new BadRequestException('type must be "flight" or "hotel"'),
  });
}
