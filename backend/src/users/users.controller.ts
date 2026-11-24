import { RevalidationService } from '../revalidation/revalidation.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { clearAuthCookies } from '../auth/auth-cookies';
import { AuthService } from '../auth/auth.service';
import { CurrentUser, Roles } from '../common/decorators';
import { Role } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/interfaces';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileResponse, UsersService } from './users.service';
import { NoStoreInterceptor } from '../auth/no-store.interceptor';

// Area: Auth & Accounts
// Requirements: ACC-09, ACC-11, ACC-12
// Endpoints to implement (PDF section 8):
//   GET    /api/users/me   ACC-11   done
//   PATCH  /api/users/me   ACC-09   done
//   DELETE /api/users/me   ACC-12   done
// Notes:
//   Deactivation is blocked while the user has upcoming Confirmed bookings (ACC-12, GEN-11).
//   Preferred currency must come from the supported currency list (ACC-09, GEN-12).
//
// DONE (Area 3, GEN-02 / GEN-13): the global ValidationPipe is registered in main.ts.
// ACC-19: account data is never cached by the browser or a proxy.
@UseInterceptors(NoStoreInterceptor)
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    // From the global AuthModule: deactivation also revokes every session (ACC-12).
    private readonly authService: AuthService,
    // B5: the author's name and posts / itineraries are on cached pages (ISR).
    private readonly revalidation: RevalidationService,
  ) {}

  // ACC-11: only the own profile can be read.
  @Get('me')
  getMe(@CurrentUser() user: AuthUser): Promise<ProfileResponse> {
    return this.usersService.getProfile(user.id);
  }

  // ACC-09: edit name, phone number and preferred currency. Nothing is saved unless every sent
  // field is valid.
  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponse> {
    const profile = await this.usersService.updateProfile(user.id, dto);
    this.revalidation.author(user.id);
    return profile;
  }

  // ACC-12: registered users only (403 for admins and moderators). 409 while there is an upcoming
  // Confirmed booking. On success the account is deactivated, every session is revoked and the
  // cookies are cleared.
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles(Role.User)
  async deactivateMe(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.deactivateOwnAccount(user);
    clearAuthCookies(res);
    // ACC-12: the author's posts and public itineraries disappear from the cached pages.
    this.revalidation.author(user.id);
  }
}
