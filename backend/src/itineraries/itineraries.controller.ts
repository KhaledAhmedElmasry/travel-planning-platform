import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { RevalidationService } from '../revalidation/revalidation.service';
import type { Request } from 'express';
import { ACCESS_COOKIE } from '../auth/auth-cookies';
import { SessionsService } from '../auth/sessions.service';
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
import { SearchPublicItinerariesQueryDto } from './dto/search-public-itineraries-query.dto';
import { ReorderDaysDto } from './dto/reorder-days.dto';
import { UpdateDayDto } from './dto/update-day.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
import { CreateTransportCostDto } from './dto/create-transport-cost.dto';
import { UpdateTransportCostDto } from './dto/update-transport-cost.dto';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { CreateBudgetEntryDto } from './dto/create-budget-entry.dto';
import { UpdateBudgetEntryDto } from './dto/update-budget-entry.dto';
import { BudgetSummaryQueryDto } from './dto/budget-summary-query.dto';
import { ItineraryHotelsQueryDto } from './dto/itinerary-hotels-query.dto';
import { ItineraryFlightsQueryDto } from './dto/itinerary-flights-query.dto';
import { AttachBookingDto } from './dto/attach-booking.dto';
import { LinkedBookingResponse } from './itinerary-bookings.service';
import {
  ActivityResponse,
  ActivityImageResponse,
  DayResponse,
  ItinerariesService,
  ItineraryResponse,
  ItinerarySummary,
  PublicItineraryResponse,
  TransportCostResponse,
  BudgetEntryResponse,
  BudgetSummaryResponse,
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
//   GET    /api/itineraries/:id/hotels                     ITN-25
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
  constructor(
    private readonly itinerariesService: ItinerariesService,
    private readonly sessionsService: SessionsService,
    private readonly revalidation: RevalidationService,
  ) {}

  // B5: after the owner changed the itinerary, refresh its cached public page and the author page
  // (ISR). Changes addressed by an activity, budget or transport-cost id are refreshed in
  // ItinerariesService.saveItinerary(), which knows the itinerary.
  private async refresh<T>(
    change: Promise<T>,
    itineraryId: Types.ObjectId | string,
    userId: string,
  ): Promise<T> {
    const result = await change;
    this.revalidation.itinerary(itineraryId, userId);
    return result;
  }

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

  // ITN-20: guests can browse public, non-hidden itineraries. Keep this before /:id.
  @Get('itineraries/public/search')
  searchPublic(
    @Query() query: SearchPublicItinerariesQueryDto,
  ): Promise<PaginatedList<ItinerarySummary>> {
    return this.itinerariesService.searchPublic(query);
  }

  @Get('itineraries/public/:id')
  async getPublic(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Req() request: Request,
    @Query('currency') currency?: string,
  ): Promise<PublicItineraryResponse> {
    // Public route; a logged-in viewer is identified only so that the author and admins can
    // still open a hidden itinerary (GEN-10).
    return this.itinerariesService.getPublic(
      id,
      currency,
      await optionalViewer(this.sessionsService, request),
    );
  }

  // ITN-25: search hotels for the selected city group, using the group's stay dates.
  @Get('itineraries/:id/hotels')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  findHotels(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @Query() query: ItineraryHotelsQueryDto,
  ) {
    return this.itinerariesService.findHotels(id, user.id, query);
  }

  // ITN-26: search flights from the chosen origin to an airport in the first city.
  // ITN-28 (bonus): the itinerary as a downloadable PDF.
  @Get('itineraries/:id/pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  async exportPdf(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
  ): Promise<StreamableFile> {
    const { pdf, title } = await this.itinerariesService.exportPdf(id, user.id);
    const name =
      title
        .replace(/[^A-Za-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'itinerary';
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="itinerary-${name}.pdf"`,
    });
  }

  // ITN-27 (bonus): link a Confirmed booking of the user to a day of the itinerary.
  @Post('itineraries/:id/bookings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  linkBooking(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @Body() dto: AttachBookingDto,
  ): Promise<LinkedBookingResponse> {
    return this.itinerariesService.linkBooking(id, user.id, dto);
  }

  @Get('itineraries/:id/flights')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  findFlights(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @Query() query: ItineraryFlightsQueryDto,
  ) {
    return this.itinerariesService.findFlights(id, user.id, query);
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

  @Post('itineraries/:id/clone')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  clone(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
  ): Promise<ItineraryResponse> {
    return this.itinerariesService.clone(id, user.id);
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
    return this.refresh(
      this.itinerariesService.update(id, user.id, dto),
      id,
      user.id,
    );
  }

  @Delete('itineraries/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.refresh(
      this.itinerariesService.remove(id, user.id),
      id,
      user.id,
    );
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
    return this.refresh(
      this.itinerariesService.addDay(id, user.id, dto),
      id,
      user.id,
    );
  }

  // ITN-08: moves a day to a new position. Declared before PATCH days/:dayId so "reorder" is
  // never read as a day id.
  @Patch('itineraries/:id/days/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  reorderDays(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReorderDaysDto,
  ): Promise<ItineraryResponse> {
    return this.refresh(
      this.itinerariesService.reorderDays(id, user.id, dto),
      id,
      user.id,
    );
  }

  // ITN-05: edits a day's city and notes.
  @Patch('itineraries/:id/days/:dayId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  updateDay(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Param('dayId', ParseObjectIdPipe) dayId: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateDayDto,
  ): Promise<DayResponse> {
    return this.refresh(
      this.itinerariesService.updateDay(id, dayId, user.id, dto),
      id,
      user.id,
    );
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
    await this.refresh(
      this.itinerariesService.deleteDay(id, dayId, user.id),
      id,
      user.id,
    );
  }

  @Post('itineraries/:id/days/:dayId/activities')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  addActivity(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Param('dayId', ParseObjectIdPipe) dayId: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateActivityDto,
  ): Promise<ActivityResponse> {
    return this.itinerariesService.addActivity(id, dayId, user.id, dto);
  }

  @Patch('activities/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  updateActivity(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateActivityDto,
  ): Promise<ActivityResponse> {
    return this.itinerariesService.updateActivity(id, user.id, dto);
  }

  @Delete('activities/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  async deleteActivity(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.itinerariesService.deleteActivity(id, user.id);
  }

  @Post('activities/:id/images')
  @UseInterceptors(FileInterceptor('image'))
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  attachActivityImage(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<ActivityImageResponse> {
    if (!file) throw new BadRequestException('image is required');
    return this.itinerariesService.attachActivityImage(id, user.id, file);
  }

  @Delete('activities/:id/images/:imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  async removeActivityImage(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Param('imageId', ParseObjectIdPipe) imageId: Types.ObjectId,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.itinerariesService.removeActivityImage(id, imageId, user.id);
  }

  @Post('itineraries/:id/days/:dayId/budgets')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  addBudgetEntry(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Param('dayId', ParseObjectIdPipe) dayId: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateBudgetEntryDto,
  ): Promise<BudgetEntryResponse> {
    return this.itinerariesService.addBudgetEntry(id, dayId, user.id, dto);
  }

  @Patch('budgets/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  updateBudgetEntry(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateBudgetEntryDto,
  ): Promise<BudgetEntryResponse> {
    return this.itinerariesService.updateBudgetEntry(id, user.id, dto);
  }

  @Delete('budgets/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  async deleteBudgetEntry(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.itinerariesService.deleteBudgetEntry(id, user.id);
  }

  @Get('itineraries/:id/budget-summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  getBudgetSummary(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @Query() query: BudgetSummaryQueryDto,
  ): Promise<BudgetSummaryResponse> {
    return this.itinerariesService.getBudgetSummary(
      id,
      user.id,
      query.currency,
    );
  }

  @Post('itineraries/:id/transport-costs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  addTransportCost(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTransportCostDto,
  ): Promise<TransportCostResponse> {
    return this.itinerariesService.addTransportCost(id, user.id, dto);
  }

  @Patch('transport-costs/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  updateTransportCost(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateTransportCostDto,
  ): Promise<TransportCostResponse> {
    return this.itinerariesService.updateTransportCost(id, user.id, dto);
  }

  @Delete('transport-costs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  async deleteTransportCost(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.itinerariesService.deleteTransportCost(id, user.id);
  }
}

// The account of the access cookie, or undefined for a guest or an ended session.
async function optionalViewer(
  sessions: SessionsService,
  request: Request,
): Promise<AuthUser | undefined> {
  const cookies = request.cookies as Record<string, unknown> | undefined;
  const token = cookies?.[ACCESS_COOKIE];
  if (typeof token !== 'string') return undefined;
  try {
    return await sessions.authenticate(token);
  } catch (error) {
    if (
      error instanceof UnauthorizedException ||
      error instanceof ForbiddenException
    ) {
      return undefined;
    }
    throw error;
  }
}
