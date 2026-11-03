import {
  Body,
  Controller,
  Param,
  Patch,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../common/decorators';
import { Role } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/interfaces';
import { AdminService } from './admin.service';
import { AdminActionDto } from './dto/admin-action.dto';

// Area: Auth & Accounts
// Requirements: ACC-07a, ACC-13, ACC-14, ACC-15, ACC-16, ACC-17
// Endpoints to implement (PDF section 8):
//   POST  /api/admin/moderators                 ACC-13
//   GET   /api/admin/accounts                   ACC-14
//   PATCH /api/admin/accounts/:id/suspend       ACC-15, ACC-16
//   PATCH /api/admin/accounts/:id/reactivate    ACC-15, ACC-16
//   POST  /api/admin/users/:id/reset-password   ACC-07a
//   GET   /api/admin/bookings                   ACC-17
// Extra endpoints may be needed (not in the PDF tables) for:
//   deactivating / reactivating a hotel or airline (ACC-15). Notify affected parties (GEN-01) and
//   write an audit entry (GEN-07).
// Notes:
//   Admin only. Suspending an account or resetting its password revokes its sessions (NEW-07).
//   Admin accounts are seeded, never registered (ACC-18).
// BONUS (optional): implement only after all mandatory requirements are done (PDF section 12).
// Bonus endpoints:
//   an analytics endpoint: bookings and revenue per provider over a period   BON-01
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ACC-15, ACC-16: Suspend a user or moderator account
  @Patch('accounts/:id/suspend')
  suspendAccount(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto?: AdminActionDto,
  ) {
    return this.adminService.suspendAccount(admin, id, dto);
  }

  // ACC-15, ACC-16: Reactivate a suspended user or moderator account
  @Patch('accounts/:id/reactivate')
  reactivateAccount(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto?: AdminActionDto,
  ) {
    return this.adminService.reactivateAccount(admin, id, dto);
  }
}
