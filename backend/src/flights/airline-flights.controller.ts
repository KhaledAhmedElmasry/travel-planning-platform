import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import type { AuthUser } from '../common/interfaces';
import { ListAirlineFlightsQueryDto } from './dto/list-airline-flights-query.dto';
import { FlightsService } from './flights.service';

// Area: Airlines & Flight Inventory
// Requirements: FLT-03, FLT-05, ACC-11, ACC-13, GEN-05
// Extra endpoint (not in the PDF tables; MILESTONE2 spec section 8, team leader 23 Nov):
//   GET /api/airlines/:id/flights   the airline moderator's own flights (P-36)   (done)
// Lives in the flights module: AirlinesModule cannot import FlightsModule (FlightsModule
// already imports AirlinesModule).
@Controller('airlines')
export class AirlineFlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  @Get(':id/flights')
  @UseGuards(JwtAuthGuard)
  list(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Query() query: ListAirlineFlightsQueryDto,
  ) {
    return this.flightsService.listForAirline(user, id, query);
  }
}
