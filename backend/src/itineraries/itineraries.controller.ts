import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { CurrentUser, Roles } from '../common/decorators';
import { Role } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/interfaces';
import { PaginatedList } from '../common/dto/pagination.dto';
import { CreateDayDto } from './dto/create-day.dto';
import { DeleteDayQueryDto } from './dto/delete-day-query.dto';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { ListItinerariesQueryDto } from './dto/list-itineraries-query.dto';
import { UpdateDayDto } from './dto/update-day.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
import {
  DayResponse,
  ItinerariesService,
  ItineraryResponse,
  ItinerarySummary,
} from './itineraries.service';

// Area: Itineraries
// Requirements: ITN-01..ITN-26
// Endpoints to implement (PDF section 8):
//   POST   /api/itineraries                                ITN-01
//   GET    /api/itineraries                                ITN-03
//   GET    /api/itineraries/:id                            ITN-03
//   PATCH  /api/itineraries/:id                            ITN-01, ITN-20
//   DELETE /api/itineraries/:id                            ITN-01
//   POST   /api/itineraries/:id/days                       ITN-05
//   PATCH  /api/itineraries/:id/days/:dayId                ITN-05
//   DELETE /api/itineraries/:id/days/:dayId                ITN-07
//   PATCH  /api/itineraries/:id/days/reorder               ITN-08
//   POST   /api/itineraries/:id/days/:dayId/activities     ITN-10
//   PATCH  /api/activities/:id                             ITN-10
//   DELETE /api/activities/:id                             ITN-10
//   POST   /api/activities/:id/images                      ITN-12, GEN-08
//   DELETE /api/activities/:id/images/:imageId             ITN-12
//   POST   /api/itineraries/:id/days/:dayId/budgets        ITN-14
//   PATCH  /api/budgets/:id                                ITN-14
//   DELETE /api/budgets/:id                                ITN-14
//   POST   /api/itineraries/:id/transport-costs            ITN-16
//   PATCH  /api/transport-costs/:id                        ITN-16
//   DELETE /api/transport-costs/:id                        ITN-16
//   GET    /api/itineraries/:id/budget-summary             ITN-14, ITN-18
//   GET    /api/itineraries/public/search                  ITN-20, ITN-21
//   GET    /api/itineraries/public/:id                     ITN-21
//   POST   /api/itineraries/:id/clone                      ITN-21
//   GET    /api/itineraries/:id/hotels                     ITN-09
//   GET    /api/itineraries/:id/flights                    ITN-26
// Notes:
//   Private itineraries are visible only to their owner (ACC-11): check ownership in the service.
//   Declare /itineraries/public/... and /days/reorder before the :id and :dayId routes.
//   The hotels endpoint (GET /api/itineraries/:id/hotels) also covers ITN-25 (hotels for a city group).
//   ITN-25 and ITN-26 reuse the hotel search (HTL-11) and flight search (FLT-11, FLT-12) services.
// BONUS (optional): implement only after all mandatory requirements are done (PDF section 12).
// Bonus endpoints:
//   POST /api/itineraries/:id/bookings   ITN-27 (Optional)
//   GET  /api/itineraries/:id/pdf        ITN-28 (Optional)
@Controller()
export class ItinerariesController {
  constructor(private readonly itinerariesService: ItinerariesService) {}

  // ITN-01: registered users create private itineraries only. Visibility changes are ITN-20.
  @Post('itineraries')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateItineraryDto,
  ): Promise<ItineraryResponse> {
    return this.itinerariesService.create(user.id, dto);
  }

  // ITN-03 / GEN-04 / GEN-05: only the current user's itineraries, ten at a time.
  @Get('itineraries')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListItinerariesQueryDto,
  ): Promise<PaginatedList<ItinerarySummary>> {
    return this.itinerariesService.list(user.id, query.page);
  }

  // ITN-03 / ACC-11: ownership is checked by the service; invalid ids are rejected at the edge.
  @Get('itineraries/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  getOne(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
  ): Promise<ItineraryResponse> {
    return this.itinerariesService.getOne(id, user.id);
  }

  // ITN-01: ownership is enforced in the service so another user's itinerary is indistinguishable
  // from a missing one (ACC-11).
  @Patch('itineraries/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateItineraryDto,
  ): Promise<ItineraryResponse> {
    return this.itinerariesService.update(id, user.id, dto);
  }

  @Delete('itineraries/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.itinerariesService.remove(id, user.id);
  }

  // ITN-05: adds a day at the end; the service sets its number and date.
  @Post('itineraries/:id/days')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  addDay(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDayDto,
  ): Promise<DayResponse> {
    return this.itinerariesService.addDay(id, user.id, dto);
  }

  // ITN-05: edits a day's city and notes. ITN-08 must declare PATCH days/reorder above this route.
  @Patch('itineraries/:id/days/:dayId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  updateDay(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Param('dayId', ParseObjectIdPipe) dayId: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateDayDto,
  ): Promise<DayResponse> {
    return this.itinerariesService.updateDay(id, dayId, user.id, dto);
  }

  @Delete('itineraries/:id/days/:dayId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  async deleteDay(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Param('dayId', ParseObjectIdPipe) dayId: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @Query() query: DeleteDayQueryDto,
  ): Promise<void> {
    if (!query.confirm) {
      throw new BadRequestException(
        'Confirmation is required to delete an itinerary day.',
      );
    }
    await this.itinerariesService.deleteDay(id, dayId, user.id);
  }
}
