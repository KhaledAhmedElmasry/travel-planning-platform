import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, RequireVerifiedEmail } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import type { AuthUser } from '../common/interfaces';
import { RegisteredUserGuard } from '../payments/registered-user.guard';
import { BookingType } from '../common/enums';
import { CreateFlightBookingDto } from './dto/create-flight-booking.dto';
import { FlightBookingRequestDto } from './dto/hold-flight-booking.dto';
import { ListFlightBookingsQueryDto } from './dto/list-flight-bookings-query.dto';
import { ChangeFlightDto } from './dto/change-flight.dto';
import { SelectSeatDto } from './dto/select-seat.dto';
import { FlightBookingChangeService } from './flight-booking-change.service';
import {
  FlightSeatSelectionService,
  SeatMapResponse,
} from './flight-seat-selection.service';
import { PaymentsService } from '../payments/payments.service';
import { RefundsService } from '../payments/refunds.service';
import {
  CancelledFlightBookingResponse,
  FlightBookingLifecycleService,
} from './flight-booking-lifecycle.service';
import {
  FlightBookingResponse,
  FlightBookingsService,
} from './flight-bookings.service';
import { FlightBookingQuote } from './interfaces/flight-booking-quote.interface';

// Area: Payments, Holds & Booking Engine (hold, cancel, e-ticket) and Search & My Bookings
// (summary, list, details)
// Requirements: FLT-19, FLT-21, FLT-22, FLT-23, FLT-25, FLT-26, GEN-11
// Endpoints to implement (PDF section 8):
//   POST /api/flight-bookings/hold            FLT-22           done
//   POST /api/flight-bookings                 FLT-19, FLT-21   done
//   GET  /api/flight-bookings                 FLT-25           done
//   GET  /api/flight-bookings/:id             FLT-25           done
//   POST /api/flight-bookings/:id/cancel      FLT-26           done
//   GET  /api/flight-bookings/:id/e-ticket    FLT-23           done
// Notes:
//   The booking details (GET /api/flight-bookings/:id) show the refund the user would get before
//   they cancel (FLT-26: "after viewing the refund amount computed from the airline's tiers");
//   there is no separate refund-preview endpoint: use FlightBookingLifecycleService
//   .previewCancellation(booking) (the same function cancel uses).
//   Users see only their own bookings (ACC-11). Group the list as Upcoming / Past / Cancelled (FLT-25);
//   Upcoming = upcomingFlightBookings() in flight-bookings.service.ts (GEN-11).
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
//   GET   /api/flight-bookings/:id/seats           FLT-28 (Optional, seat map; not in the PDF table)
@Controller('flight-bookings')
export class FlightBookingsController {
  constructor(
    private readonly flightBookingsService: FlightBookingsService,
    private readonly lifecycle: FlightBookingLifecycleService,
    private readonly refunds: RefundsService,
    private readonly payments: PaymentsService,
    private readonly seatSelection: FlightSeatSelectionService,
    private readonly changes: FlightBookingChangeService,
  ) {}

  // FLT-19 / FLT-21: return the summary without creating a booking or holding seats.
  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RegisteredUserGuard)
  quote(@Body() dto: CreateFlightBookingDto): Promise<FlightBookingQuote> {
    return this.flightBookingsService.quote(dto);
  }

  // FLT-25: list the current user's bookings by Upcoming, Past or Cancelled.
  @Get()
  @UseGuards(JwtAuthGuard, RegisteredUserGuard)
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListFlightBookingsQueryDto,
  ) {
    return this.flightBookingsService.listOwn(user.id, query);
  }

  // FLT-25: full details are owner-only and include refund state plus the current cancellation
  // preview used by the cancellation endpoint.
  @Get(':id')
  @UseGuards(JwtAuthGuard, RegisteredUserGuard)
  async details(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const booking = await this.flightBookingsService.findOwned(user.id, id);
    const [payment, refund, cancellation, seatAssignments] = await Promise.all([
      this.payments.findPaymentForBooking(BookingType.Flight, id),
      this.refunds.findRefundForBooking(BookingType.Flight, id),
      this.lifecycle.previewCancellation(booking),
      this.seatSelection.list(booking),
    ]);
    return {
      ...this.flightBookingsService.toResponse(booking),
      payment,
      refund,
      cancellation,
      // FLT-28 (bonus): the seats the passengers chose.
      seatAssignments,
    };
  }

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

  // FLT-27 (bonus): move one flight of a Confirmed booking to another flight on the same route
  // and in the same cabin; a higher fare is paid, a lower fare is refunded.
  @Patch(':id/change-flight')
  @UseGuards(JwtAuthGuard, RegisteredUserGuard)
  changeFlight(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ChangeFlightDto,
  ) {
    return this.changes.changeFlight(user.id, id, dto);
  }

  // FLT-28 (bonus): choose or change the seat of one passenger on one flight of a Confirmed
  // booking. Returns the booking with its seats.
  @Patch(':id/seat')
  @UseGuards(JwtAuthGuard, RegisteredUserGuard)
  async selectSeat(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SelectSeatDto,
  ) {
    const booking = await this.flightBookingsService.findOwned(user.id, id);
    const seatAssignments = await this.seatSelection.selectSeat(booking, dto);
    return {
      ...this.flightBookingsService.toResponse(booking),
      seatAssignments,
    };
  }

  // FLT-28 (bonus): the seat map of each flight of the booking (available, taken, this booking's
  // own). Same owner rule as the details: another user's booking answers 404.
  @Get(':id/seats')
  @UseGuards(JwtAuthGuard, RegisteredUserGuard)
  async seats(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<SeatMapResponse> {
    const booking = await this.flightBookingsService.findOwned(user.id, id);
    return this.seatSelection.seatMap(booking);
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
