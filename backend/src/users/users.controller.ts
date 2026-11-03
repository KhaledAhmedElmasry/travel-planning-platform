import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import type { AuthUser } from '../common/interfaces';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileResponse, UsersService } from './users.service';

// Area: Auth & Accounts
// Requirements: ACC-09, ACC-11, ACC-12
// Endpoints to implement (PDF section 8):
//   GET    /api/users/me   ACC-11   done
//   PATCH  /api/users/me   ACC-09   done
//   DELETE /api/users/me   ACC-12
// Notes:
//   Deactivation is blocked while the user has upcoming Confirmed bookings (ACC-12, NEW-01).
//   Preferred currency must come from the supported currency list (ACC-09, GEN-12).
//
// DONE (Area 3, GEN-02 / GEN-13): the global ValidationPipe is registered in main.ts.
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponse> {
    return this.usersService.updateProfile(user.id, dto);
  }
}
