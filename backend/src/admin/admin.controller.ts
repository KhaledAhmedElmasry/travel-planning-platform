import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../common/decorators';
import { ProviderType, Role } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/interfaces';
import { RevalidationService } from '../revalidation/revalidation.service';
import { AdminService } from './admin.service';
import { AdminActionDto } from './dto/admin-action.dto';
import { CreateModeratorDto } from './dto/create-moderator.dto';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { ListProvidersQueryDto } from './dto/list-providers-query.dto';

// Area: Auth & Accounts
// Requirements: ACC-07a, ACC-13, ACC-14, ACC-15, ACC-16, ACC-17
// Endpoints to implement (PDF section 8):
//   POST  /api/admin/moderators                 ACC-13
//   GET   /api/admin/accounts                   ACC-14
//   PATCH /api/admin/accounts/:id/suspend       ACC-15, ACC-16
//   PATCH /api/admin/accounts/:id/reactivate    ACC-15, ACC-16
//   POST  /api/admin/users/:id/reset-password   ACC-07a
//   PATCH /api/admin/providers/:type/:id/deactivate   ACC-15   (:type = hotel | airline)
//   PATCH /api/admin/providers/:type/:id/reactivate   ACC-15
//   GET   /api/admin/bookings                   ACC-17
// Deactivating a provider notifies its moderator and every user with a Confirmed booking with it
// (GEN-01); deactivating and reactivating both write an audit entry (GEN-07).
// Notes:
//   Admin only. Suspending an account or resetting its password revokes its sessions (ACC-19).
//   Admin accounts are seeded, never registered (ACC-18).
// BONUS (optional): implement only after all mandatory requirements are done (PDF section 12).
// Bonus endpoints:
//   an analytics endpoint: bookings and revenue per provider over a period   BON-01
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    // B5: a suspended or reactivated author's pages are cached (ISR).
    private readonly revalidation: RevalidationService,
  ) {}

  // ACC-13, GEN-01-B: Create a hotel or airline moderator
  @Post('moderators')
  @HttpCode(HttpStatus.CREATED)
  createModerator(
    @CurrentUser() admin: AuthUser,
    @Body() dto: CreateModeratorDto,
  ) {
    return this.adminService.createModerator(admin, dto);
  }

  // ACC-14: Paginated list of all accounts with search and filters
  @Get('accounts')
  getAccounts(@Query() query: ListAccountsQueryDto) {
    return this.adminService.listAccounts(query);
  }

  // P-50 providers table, P-49 provider select (extra endpoint, MILESTONE2 spec section 8)
  @Get('providers')
  getProviders(@Query() query: ListProvidersQueryDto) {
    return this.adminService.listProviders(query);
  }

  // ACC-15, ACC-16: Suspend a user or moderator account
  @Patch('accounts/:id/suspend')
  async suspendAccount(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body() dto?: AdminActionDto,
  ) {
    const result = await this.adminService.suspendAccount(admin, id, dto);
    this.revalidation.author(id);
    return result;
  }

  // ACC-15, ACC-16: Reactivate a suspended user or moderator account
  @Patch('accounts/:id/reactivate')
  async reactivateAccount(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body() dto?: AdminActionDto,
  ) {
    const result = await this.adminService.reactivateAccount(admin, id, dto);
    this.revalidation.author(id);
    return result;
  }

  // ACC-15: deactivate a hotel or airline (:type is hotel or airline). It is hidden from search
  // and cannot be booked; its existing Confirmed bookings stay valid.
  @Patch('providers/:type/:id/deactivate')
  deactivateProvider(
    @CurrentUser() admin: AuthUser,
    @Param('type', new ParseEnumPipe(ProviderType)) type: ProviderType,
    @Param('id') id: string,
    @Body() dto?: AdminActionDto,
  ) {
    return type === ProviderType.Airline
      ? this.adminService.deactivateAirline(admin, id, dto)
      : this.adminService.deactivateHotel(admin, id, dto);
  }

  // ACC-15: reactivate a deactivated hotel or airline.
  @Patch('providers/:type/:id/reactivate')
  reactivateProvider(
    @CurrentUser() admin: AuthUser,
    @Param('type', new ParseEnumPipe(ProviderType)) type: ProviderType,
    @Param('id') id: string,
    @Body() dto?: AdminActionDto,
  ) {
    return type === ProviderType.Airline
      ? this.adminService.reactivateAirline(admin, id, dto)
      : this.adminService.reactivateHotel(admin, id, dto);
  }

  // ACC-17: View a read-only list of all flight and hotel bookings
  @Get('bookings')
  getBookings(@Query() query: ListBookingsQueryDto) {
    return this.adminService.listBookings(query);
  }

  // BON-01: Admin analytics dashboard showing bookings and revenue per provider over a selected period
  @Get('analytics')
  getAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.adminService.getAnalytics(query);
  }
}
