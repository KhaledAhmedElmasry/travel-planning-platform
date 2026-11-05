import { Controller, Get, Query } from '@nestjs/common';
import { SearchFlightsQueryDto } from './dto/search-flights-query.dto';
import { FlightSearchService } from './flight-search.service';

// Area: Flight Search & Booking
// Requirements: FLT-11, FLT-12, FLT-15
// Endpoints (PDF section 8):
//   GET /api/flights/search   FLT-11, FLT-12, FLT-15   (done)
// Public (guests too). Validation by the global ValidationPipe (GEN-02).
@Controller('flights')
export class FlightSearchController {
  constructor(private readonly flightSearchService: FlightSearchService) {}

  @Get('search')
  search(@Query() query: SearchFlightsQueryDto) {
    return this.flightSearchService.search(query);
  }
}
