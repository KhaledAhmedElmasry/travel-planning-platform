import {
  Body,
  Controller,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import type { AuthUser } from '../common/interfaces';
import { CreateCabinDto } from './dto/create-cabin.dto';
import { CreateFlightDto } from './dto/create-flight.dto';
import { UpdateCabinDto } from './dto/update-cabin.dto';
import { UpdateFlightDto } from './dto/update-flight.dto';
import { FlightsService } from './flights.service';

// Area: Airlines & Flight Inventory
// Requirements: FLT-03, FLT-04, FLT-05, FLT-06, FLT-17, FLT-29, FLT-30, GEN-06, NEW-02
// Endpoints to implement (PDF section 8):
//   POST  /api/flights                          FLT-03   (done)
//   GET   /api/flights/:id                      FLT-17
//   PATCH /api/flights/:id                      FLT-05   (done)
//   POST  /api/flights/:id/cancel               FLT-06   (done)
//   POST  /api/flights/:id/cabins               FLT-04   (done)
//   PATCH /api/flights/:id/cabins/:cabinId      FLT-04, FLT-05   (done)
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

  // FLT-03: an airline moderator creates a flight for their own airline. The role check
  // (403 "Not an airline moderator.") is in the service.
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateFlightDto) {
    return this.flightsService.create(user, dto);
  }

  // FLT-05: the moderator of the flight's airline edits its airports and local times.
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: UpdateFlightDto,
  ) {
    return this.flightsService.update(user, id, dto);
  }

  // FLT-06: the moderator of the flight's airline cancels it: its bookings are cancelled with a
  // 100% refund (Area 1) and the passengers are notified. 200 with the counts.
  @Post(':id/cancel')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ) {
    return this.flightsService.cancel(user, id);
  }

  // FLT-04: the moderator of the flight's airline adds a cabin class.
  @Post(':id/cabins')
  @UseGuards(JwtAuthGuard)
  addCabin(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: CreateCabinDto,
  ) {
    return this.flightsService.addCabin(user, id, dto);
  }

  // FLT-04, FLT-05: the moderator edits a cabin's seats, price and baggage allowance.
  @Patch(':id/cabins/:cabinId')
  @UseGuards(JwtAuthGuard)
  updateCabin(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Param('cabinId', ParseObjectIdPipe) cabinId: Types.ObjectId,
    @Body() dto: UpdateCabinDto,
  ) {
    return this.flightsService.updateCabin(user, id, cabinId, dto);
  }
}
