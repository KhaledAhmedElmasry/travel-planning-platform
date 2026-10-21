import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HotelBookingsService } from './hotel-bookings.service';

// Owner: Member 7 (Hotel Booking & Reviews)
// Requirements: HTL-16, HTL-17, HTL-18, HTL-20, HTL-21, GEN-11, NEW-01
// Endpoints to implement (PDF section 8):
//   POST /api/hotel-bookings               HTL-16, HTL-18
//   GET  /api/hotel-bookings               HTL-20
//   GET  /api/hotel-bookings/:id           HTL-20
//   POST /api/hotel-bookings/:id/cancel    HTL-21
@ApiTags('Hotel Bookings')
@Controller('hotel-bookings')
export class HotelBookingsController {
  constructor(private readonly hotelBookingsService: HotelBookingsService) {}

  // TODO: add the endpoints listed above.
}
