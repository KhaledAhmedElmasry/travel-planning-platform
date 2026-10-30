import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
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
//   total"); there is no separate refund-preview endpoint.
//   Users see only their own reservations (ACC-11). Group the list as Upcoming / Past / Cancelled (HTL-20).
//   All selected rooms are held together or not at all (HTL-18, PDF section 6.3).
//   HTL-17 (confirmation) has no endpoint: the Stripe webhook confirms the reservation.
//
// WAITING FOR (Area 2, ACC-04 / ACC-11 / ACC-19): JwtAuthGuard, the user role check (403 for
//   non-users) and @CurrentUser(). Until then currentUserId() below answers 401. When they are
//   merged, add the guard to every route and replace currentUserId(req) with @CurrentUser().
// WAITING FOR (Area 3, GEN-02 / GEN-13): the global ValidationPipe; then remove the local one.
@Controller('hotel-bookings')
export class HotelBookingsController {
  constructor(
    private readonly hotelBookingsService: HotelBookingsService,
    private readonly lifecycle: HotelBookingLifecycleService,
  ) {}

  // HTL-16, HTL-18: book one or more rooms and hold them for 10 minutes (pending_payment).
  @Post()
  book(
    @Req() req: Request,
    @Body(new ValidationPipe({ whitelist: true })) dto: CreateHotelBookingDto,
  ): Promise<HotelBookingResponse> {
    return this.hotelBookingsService.book(currentUserId(req), dto);
  }

  // HTL-21: cancel a confirmed reservation before check-in; returns it with its refund.
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<CancelledHotelBookingResponse> {
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
