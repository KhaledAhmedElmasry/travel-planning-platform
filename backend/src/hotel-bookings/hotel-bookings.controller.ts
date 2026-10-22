import { Controller } from '@nestjs/common';
import { HotelBookingsService } from './hotel-bookings.service';

// Area: Hotel Booking & Reviews
// Requirements: HTL-16, HTL-17, HTL-18, HTL-20, HTL-21, GEN-11, NEW-01
// Endpoints to implement (PDF section 8):
//   POST /api/hotel-bookings               HTL-16, HTL-18
//   GET  /api/hotel-bookings               HTL-20
//   GET  /api/hotel-bookings/:id           HTL-20
//   POST /api/hotel-bookings/:id/cancel    HTL-21
// Also needed by the requirements (not in the PDF tables):
//   a refund preview before cancelling, e.g. GET /api/hotel-bookings/:id/refund-preview (HTL-21:
//   "after viewing the refund computed from the hotel's tiers on the full total")
// Notes:
//   Users see only their own reservations (ACC-11). Group the list as Upcoming / Past / Cancelled (HTL-20).
//   All selected rooms are held together or not at all (HTL-18, PDF section 6.3).
@Controller('hotel-bookings')
export class HotelBookingsController {
  constructor(private readonly hotelBookingsService: HotelBookingsService) {}

  // TODO: add the endpoints listed above.
}
