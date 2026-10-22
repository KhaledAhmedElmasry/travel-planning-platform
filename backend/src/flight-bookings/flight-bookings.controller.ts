import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FlightBookingsService } from './flight-bookings.service';

// Area: Flight Search & Booking
// Requirements: FLT-19, FLT-21, FLT-22, FLT-23, FLT-25, FLT-26, GEN-11, NEW-01
// Endpoints to implement (PDF section 8):
//   POST /api/flight-bookings/hold            FLT-22
//   POST /api/flight-bookings                 FLT-19, FLT-21
//   GET  /api/flight-bookings                 FLT-25
//   GET  /api/flight-bookings/:id             FLT-25
//   POST /api/flight-bookings/:id/cancel      FLT-26
//   GET  /api/flight-bookings/:id/e-ticket    FLT-23
// Also needed by the requirements (not in the PDF tables):
//   a refund preview before cancelling, e.g. GET /api/flight-bookings/:id/refund-preview (FLT-26:
//   "after viewing the refund amount computed from the airline's tiers")
// Notes:
//   Users see only their own bookings (ACC-11). Group the list as Upcoming / Past / Cancelled (FLT-25).
//   The e-ticket is a downloadable PDF (FLT-23); a PDF library must be added to package.json.
// BONUS (optional): implement only after all mandatory requirements are done (PDF section 12).
// Bonus endpoints:
//   PATCH /api/flight-bookings/:id/change-flight   FLT-27 (Optional)
//   PATCH /api/flight-bookings/:id/seat            FLT-28 (Optional)
@ApiTags('Flight Bookings')
@Controller('flight-bookings')
export class FlightBookingsController {
  constructor(private readonly flightBookingsService: FlightBookingsService) {}

  // TODO: add the endpoints listed above.
}
