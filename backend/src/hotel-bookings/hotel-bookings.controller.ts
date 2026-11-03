import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import type { AuthUser } from '../common/interfaces';
import { RegisteredUserGuard } from '../payments/registered-user.guard';
import { CreateHotelBookingDto } from './dto/create-hotel-booking.dto';
import {
  CancelledHotelBookingResponse,
  HotelBookingLifecycleService,
} from './hotel-booking-lifecycle.service';
import {
  HotelBookingResponse,
  HotelBookingsService,
} from './hotel-bookings.service';

// Area: Payments, Holds & Booking Engine (book + hold, cancel) and Search & My Bookings (list,
// details)
// Requirements: HTL-16, HTL-17, HTL-18, HTL-20, HTL-21, GEN-11, NEW-01
// Endpoints to implement (PDF section 8):
//   POST /api/hotel-bookings               HTL-16, HTL-18   done
//   GET  /api/hotel-bookings               HTL-20           TODO (Area 6)
//   GET  /api/hotel-bookings/:id           HTL-20           TODO (Area 6)
//   POST /api/hotel-bookings/:id/cancel    HTL-21           done
// Notes:
//   The reservation details (GET /api/hotel-bookings/:id) show the refund the user would get before
//   they cancel (HTL-21: "after viewing the refund computed from the hotel's tiers on the full
//   total"); there is no separate refund-preview endpoint: use HotelBookingLifecycleService
//   .previewCancellation(booking) (the same function cancel uses).
//   Users see only their own reservations (ACC-11). Group the list as Upcoming / Past / Cancelled (HTL-20);
//   Upcoming = upcomingHotelBookings() in hotel-bookings.service.ts (NEW-01).
//   All selected rooms are held together or not at all (HTL-18, PDF section 6.3).
//   HTL-17 (confirmation) has no endpoint: the Stripe webhook confirms the reservation.
//
//   Book and cancel need a login (401, JwtAuthGuard) and the role `user` (403 for admins
//   and moderators, RegisteredUserGuard); the services also check that the booking is the user's
//   own (404 otherwise, ACC-11).
// DONE (Area 3, GEN-02 / GEN-13): the global ValidationPipe is registered in main.ts.
@Controller('hotel-bookings')
export class HotelBookingsController {
  constructor(
    private readonly hotelBookingsService: HotelBookingsService,
    private readonly lifecycle: HotelBookingLifecycleService,
  ) {}

  // HTL-16, HTL-18: book one or more rooms and hold them for 10 minutes (pending_payment).
  @Post()
  @UseGuards(JwtAuthGuard, RegisteredUserGuard)
  book(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateHotelBookingDto,
  ): Promise<HotelBookingResponse> {
    return this.hotelBookingsService.book(user.id, dto);
  }

  // HTL-21: cancel a confirmed reservation before check-in; returns it with its refund.
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard, RegisteredUserGuard)
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<CancelledHotelBookingResponse> {
    return this.lifecycle.cancel(user.id, id);
  }
}
