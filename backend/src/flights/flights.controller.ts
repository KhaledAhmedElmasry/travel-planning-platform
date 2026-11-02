import { Controller } from '@nestjs/common';
import { FlightsService } from './flights.service';

// Area: Airlines & Flight Inventory
// Requirements: FLT-03, FLT-04, FLT-05, FLT-06, FLT-17, FLT-29, FLT-30, GEN-06, NEW-02
// Endpoints to implement (PDF section 8):
//   POST  /api/flights                          FLT-03
//   GET   /api/flights/:id                      FLT-17
//   PATCH /api/flights/:id                      FLT-05
//   POST  /api/flights/:id/cancel               FLT-06
//   POST  /api/flights/:id/cabins               FLT-04
//   PATCH /api/flights/:id/cabins/:cabinId      FLT-04, FLT-05
//   GET   /api/flights/:id/bookings             FLT-29
//   GET   /api/flights/:id/passengers/export    FLT-29
// Notes:
//   Flight search is in flight-search.controller.ts. It is listed first in
//   flights.module.ts so /flights/search is not matched as /flights/:id.
//   POST /api/flights/:id/cancel (FLT-06, NEW-02): the bookings of the flight are changed by
//   FlightBookingLifecycleService (Area 1); see "Effect on existing flight bookings" in
//   schemas/flight.schema.ts.
@Controller('flights')
export class FlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  // TODO: add the endpoints listed above.
}
