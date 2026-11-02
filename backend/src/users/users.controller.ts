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
  ValidationPipe,
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

// Area: Auth & Accounts
// Requirements: ACC-09, ACC-11, ACC-12
// Endpoints to implement (PDF section 8):
//   GET    /api/users/me   ACC-11   done
//   PATCH  /api/users/me   ACC-09   done
//   DELETE /api/users/me   ACC-12   done
// Notes:
//   Deactivation is blocked while the user has upcoming Confirmed bookings (ACC-12, NEW-01).
//   Preferred currency must come from the supported currency list (ACC-09, GEN-12).
//
// WAITING FOR (Area 3, GEN-02 / GEN-13): the global ValidationPipe; then remove the local one.
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    // From the global AuthModule: deactivation also revokes every session (ACC-12).
    private readonly authService: AuthService,
  ) {}

  // ACC-11: only the own profile can be read.
  @Get('me')
  getMe(@CurrentUser() user: AuthUser): Promise<ProfileResponse> {
    return this.usersService.getProfile(user.id);
  }

  // ACC-09: edit name, phone number and preferred currency. Nothing is saved unless every sent
  // field is valid.
  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthUser,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateProfileDto,
  ): Promise<ProfileResponse> {
    return this.usersService.updateProfile(user.id, dto);
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
  }
}
