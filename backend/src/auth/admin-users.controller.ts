import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AdminResetPasswordDto } from '../admin/dto/reset-password.dto';
import { Roles } from '../common/decorators';
import { Role } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthService, ResetPasswordResponse } from './auth.service';

// Area: Auth & Accounts
// Requirements: ACC-07a
// Endpoints:
//   POST /api/admin/users/:id/reset-password   ACC-07a   done
// Notes:
//   Admin only. Kept in AuthModule (not admin/) because it needs the password and session logic
//   that lives here, and so it does not conflict with the admin endpoints of Area 3. The URL is
//   exactly the one in openapi.yaml.
//
// WAITING FOR (GEN-07): AuditService. When it is implemented, record a "reset_password" entry
//   with the admin id and the account id in AuthService.resetPasswordByAdmin.
// DONE (Area 3, GEN-02 / GEN-13): the global ValidationPipe is registered in main.ts.
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminUsersController {
  constructor(private readonly authService: AuthService) {}

  // ACC-07a: set a temporary password for a registered user or a moderator. All their sessions
  // are revoked and they must set a new password at their next login.
  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: AdminResetPasswordDto,
  ): Promise<ResetPasswordResponse> {
    return this.authService.resetPasswordByAdmin(id, dto.temporaryPassword);
  }
}
