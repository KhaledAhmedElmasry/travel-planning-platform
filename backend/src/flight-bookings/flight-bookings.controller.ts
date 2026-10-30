import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  StreamableFile,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { FlightBookingRequestDto } from './dto/hold-flight-booking.dto';
import {
  CancelledFlightBookingResponse,
  FlightBookingLifecycleService,
} from './flight-booking-lifecycle.service';
import {
  FlightBookingResponse,
  FlightBookingsService,
} from './flight-bookings.service';

// Area: Payments, Holds & Booking Engine (hold, cancel, e-ticket) and Search & My Bookings
// (summary, list, details)
// Requirements: FLT-19, FLT-21, FLT-22, FLT-23, FLT-25, FLT-26, GEN-11, NEW-01
// Endpoints to implement (PDF section 8):
//   POST /api/flight-bookings/hold            FLT-22           done
//   POST /api/flight-bookings                 FLT-19, FLT-21   TODO (Area 6)
//   GET  /api/flight-bookings                 FLT-25           TODO (Area 6)
//   GET  /api/flight-bookings/:id             FLT-25           TODO (Area 6)
//   POST /api/flight-bookings/:id/cancel      FLT-26           done
//   GET  /api/flight-bookings/:id/e-ticket    FLT-23           done
// Notes:
//   The booking details (GET /api/flight-bookings/:id) show the refund the user would get before
//   they cancel (FLT-26: "after viewing the refund amount computed from the airline's tiers");
//   there is no separate refund-preview endpoint.
//   Users see only their own bookings (ACC-11). Group the list as Upcoming / Past / Cancelled (FLT-25).
//   The e-ticket is a downloadable PDF made with pdfkit (FLT-23).
//
// WAITING FOR (Area 2, ACC-04 / ACC-11 / ACC-19): JwtAuthGuard, the user role check (403 for
//   non-users) and @CurrentUser(). Until then currentUserId() below answers 401. When they are
//   merged, add the guard to every route and replace currentUserId(req) with @CurrentUser().
// WAITING FOR (Area 3, GEN-02 / GEN-13): the global ValidationPipe; then remove the local one.
// BONUS (optional): implement only after all mandatory requirements are done (PDF section 12).
// Bonus endpoints:
//   PATCH /api/flight-bookings/:id/change-flight   FLT-27 (Optional)
//   PATCH /api/flight-bookings/:id/seat            FLT-28 (Optional)
@Controller('flight-bookings')
export class FlightBookingsController {
  constructor(
    private readonly flightBookingsService: FlightBookingsService,
    private readonly lifecycle: FlightBookingLifecycleService,
  ) {}

  // FLT-22: hold the seats for 10 minutes and create the booking (pending_payment).
  @Post('hold')
  hold(
    @Req() req: Request,
    @Body(new ValidationPipe({ whitelist: true })) dto: FlightBookingRequestDto,
  ): Promise<FlightBookingResponse> {
    return this.flightBookingsService.hold(currentUserId(req), dto);
  }

  // FLT-23: the e-ticket PDF of a confirmed booking.
  @Get(':id/e-ticket')
  async eTicket(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<StreamableFile> {
    const { pdf, reference } = await this.flightBookingsService.eTicket(
      currentUserId(req),
      id,
    );
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="e-ticket-${reference}.pdf"`,
    });
  }

  // FLT-26: cancel a confirmed booking before departure; returns the booking with its refund.
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<CancelledFlightBookingResponse> {
    return this.lifecycle.cancel(currentUserId(req), id);
  }
}

// Temporary, same as in payments.controller.ts, until Area 2 adds @CurrentUser().
function currentUserId(req: Request): string {
  const user = (req as Request & { user?: { id?: string } }).user;
  if (!user?.id) {
    throw new UnauthorizedException('You must be logged in.');
  }
  return user.id;
}
