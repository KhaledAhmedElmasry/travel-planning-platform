import { Controller } from '@nestjs/common';
import { AuthService } from './auth.service';

// Area: Auth & Accounts
// Requirements: ACC-01, ACC-03, ACC-04, ACC-05, ACC-06, ACC-08, ACC-19, NEW-07
// Endpoints to implement (PDF section 8):
//   POST  /api/auth/register          ACC-01, ACC-03
//   POST  /api/auth/login             ACC-04, ACC-05
//   POST  /api/auth/logout            ACC-06
//   PATCH /api/auth/change-password   ACC-08
//   GET   /api/auth/me                ACC-04, ACC-11
// Extra endpoints may be needed (not in the PDF tables) for:
//   refreshing the session (NEW-07)
// Notes:
//   Tokens live only in httpOnly cookies, never in localStorage or sessionStorage (ACC-19).
// BONUS (optional): implement only after all mandatory requirements are done (PDF section 12).
// Bonus endpoints:
//   GET  /api/auth/verify-email      ACC-02 (Optional)
//   POST /api/auth/forgot-password   ACC-07 (Optional)
//   POST /api/auth/reset-password    ACC-07 (Optional)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // TODO: add the endpoints listed above.
}
