import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FlightBookingsService } from './flight-bookings.service';

// Owner: Member 5 (Flight Search & Booking)
// Requirements: FLT-19, FLT-21, FLT-22, FLT-23, FLT-25, FLT-26, GEN-11, NEW-01
// Endpoints to implement (PDF section 8):
//   POST /api/flight-bookings/hold            FLT-22
//   POST /api/flight-bookings                 FLT-19, FLT-21
//   GET  /api/flight-bookings                 FLT-25
//   GET  /api/flight-bookings/:id             FLT-25
//   POST /api/flight-bookings/:id/cancel      FLT-26
//   GET  /api/flight-bookings/:id/e-ticket    FLT-23
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
