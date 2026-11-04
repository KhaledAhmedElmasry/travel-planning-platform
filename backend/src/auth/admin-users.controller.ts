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
import { AuditService } from '../audit/audit.service';
import { CurrentUser, Roles } from '../common/decorators';
import { AuditAction, Role } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/interfaces';
import { AuthService, ResetPasswordResponse } from './auth.service';

// Area: Auth & Accounts
// Requirements: ACC-07a, GEN-07
// Endpoints:
//   POST /api/admin/users/:id/reset-password   ACC-07a   done
// Notes:
//   Admin only. Kept in AuthModule (not admin/) because it needs the password and session logic
//   that lives here, and so it does not conflict with the admin endpoints of Area 3. The URL is
//   exactly the one in openapi.yaml.
//   Records a "reset_password" entry in the audit log (GEN-07).
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminUsersController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  // ACC-07a: set a temporary password for a registered user or a moderator. All their sessions
  // are revoked and they must set a new password at their next login.
  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: AdminResetPasswordDto,
  ): Promise<ResetPasswordResponse> {
    const result = await this.authService.resetPasswordByAdmin(
      id,
      dto.temporaryPassword,
    );
    await this.auditService.record({
      adminId: admin.id,
      action: AuditAction.ResetPassword,
      targetType: 'account',
      targetId: id.toString(),
      details: {
        mustChangePassword: true,
      },
    });
    return result;
  }
}
