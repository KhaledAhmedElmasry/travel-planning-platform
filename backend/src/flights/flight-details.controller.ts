import { Controller, Get, Param } from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { FlightDetailsService } from './flight-details.service';

// Area: Flight Search & Booking
// Requirement: FLT-17
// Endpoints (PDF section 8):
//   GET /api/flights/:id   FLT-17   (done)
// Public (guests too). Registered after FlightSearchController (flights.module.ts) so
// /flights/search is never matched as /flights/:id.
@Controller('flights')
export class FlightDetailsController {
  constructor(private readonly flightDetailsService: FlightDetailsService) {}

  @Get(':id')
  getFlightDetails(@Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.flightDetailsService.getFlightDetails(id);
  }
}
