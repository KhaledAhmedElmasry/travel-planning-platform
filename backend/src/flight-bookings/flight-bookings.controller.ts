import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, RequireVerifiedEmail } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import type { AuthUser } from '../common/interfaces';
import { RegisteredUserGuard } from '../payments/registered-user.guard';
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
//   there is no separate refund-preview endpoint: use FlightBookingLifecycleService
//   .previewCancellation(booking) (the same function cancel uses).
//   Users see only their own bookings (ACC-11). Group the list as Upcoming / Past / Cancelled (FLT-25);
//   Upcoming = upcomingFlightBookings() in flight-bookings.service.ts (NEW-01).
//   The e-ticket is a downloadable PDF made with pdfkit (FLT-23).
//
//   Hold, e-ticket and cancel need a login (401, JwtAuthGuard) and the role `user` (403 for admins
//   and moderators, RegisteredUserGuard); the services also check that the booking is the user's
//   own (404 otherwise, ACC-11).
// DONE (Area 3, GEN-02 / GEN-13): the global ValidationPipe is registered in main.ts.
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
  @UseGuards(JwtAuthGuard, RegisteredUserGuard)
  @RequireVerifiedEmail() // ACC-02 (bonus): booking needs a verified email
  hold(
    @CurrentUser() user: AuthUser,
    @Body() dto: FlightBookingRequestDto,
  ): Promise<FlightBookingResponse> {
    return this.flightBookingsService.hold(user.id, dto);
  }

  // FLT-23: the e-ticket PDF of a confirmed booking.
  @Get(':id/e-ticket')
  @UseGuards(JwtAuthGuard, RegisteredUserGuard)
  async eTicket(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<StreamableFile> {
    const { pdf, reference } = await this.flightBookingsService.eTicket(
      user.id,
      id,
    );
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="e-ticket-${reference}.pdf"`,
    });
  }

  // FLT-26: cancel a confirmed booking before departure; returns the booking with its refund.
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard, RegisteredUserGuard)
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<CancelledFlightBookingResponse> {
    return this.lifecycle.cancel(user.id, id);
  }
}
