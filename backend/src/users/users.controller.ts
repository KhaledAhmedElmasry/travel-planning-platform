import { Controller } from '@nestjs/common';
import { UsersService } from './users.service';

// Area: Auth & Accounts
// Requirements: ACC-09, ACC-11, ACC-12
// Endpoints to implement (PDF section 8):
//   GET    /api/users/me   ACC-11
//   PATCH  /api/users/me   ACC-09
//   DELETE /api/users/me   ACC-12
// Notes:
//   Deactivation is blocked while the user has upcoming Confirmed bookings (ACC-12, NEW-01).
//   Preferred currency must come from the supported currency list (ACC-09, GEN-12).
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // TODO: add the endpoints listed above.
}
