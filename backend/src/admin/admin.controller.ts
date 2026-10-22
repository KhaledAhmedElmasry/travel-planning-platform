import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';

// Area: Auth & Accounts
// Requirements: ACC-07a, ACC-13, ACC-14, ACC-15, ACC-16, ACC-17
// Endpoints to implement (PDF section 8):
//   POST  /api/admin/moderators                 ACC-13
//   GET   /api/admin/accounts                   ACC-14
//   PATCH /api/admin/accounts/:id/suspend       ACC-15, ACC-16
//   PATCH /api/admin/accounts/:id/reactivate    ACC-15, ACC-16
//   POST  /api/admin/users/:id/reset-password   ACC-07a
//   GET   /api/admin/bookings                   ACC-17
// Also needed by the requirements (not in the PDF tables):
//   deactivate / reactivate a hotel or airline, e.g. PATCH /api/admin/providers/:type/:id/deactivate
//   and .../reactivate (ACC-15). Notify affected parties (GEN-01) and write an audit entry (GEN-07).
// Notes:
//   Admin only. Suspending an account or resetting its password revokes its sessions (NEW-07).
//   Admin accounts are seeded, never registered (ACC-18).
// BONUS (optional): implement only after all mandatory requirements are done (PDF section 12).
// Bonus endpoints:
//   an analytics endpoint: bookings and revenue per provider over a period   BON-01
@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // TODO: add the endpoints listed above.
}
