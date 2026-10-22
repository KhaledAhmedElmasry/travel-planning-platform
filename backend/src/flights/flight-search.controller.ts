import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FlightsService } from './flights.service';

// Area: Flight Search & Booking
// Requirements: FLT-11, FLT-12, FLT-15
// Endpoints to implement (PDF section 8):
//   GET /api/flights/search   FLT-11, FLT-12, FLT-15
@ApiTags('Flights')
@Controller('flights')
export class FlightSearchController {
  constructor(private readonly flightsService: FlightsService) {}

  // TODO: add the endpoint listed above.
}
