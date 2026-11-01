import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService, RegisterResponse } from './auth.service';
import { RegisterDto } from './dto/register.dto';

// Area: Auth & Accounts
// Requirements: ACC-01, ACC-03, ACC-04, ACC-05, ACC-06, ACC-08, ACC-19, NEW-07
// Endpoints to implement (PDF section 8):
//   POST  /api/auth/register          ACC-01, ACC-03   done
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
//
// WAITING FOR (Area 3, GEN-02 / GEN-13): the global ValidationPipe and error filter in main.ts.
//   Then remove the local `new ValidationPipe(...)` from the @Body() parameters below. Until the
//   filter exists, a 400 lists the messages in "message" instead of "fieldErrors".
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ACC-01, ACC-03: public, guests register without logging in. A role in the body is stripped.
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: RegisterDto,
  ): Promise<RegisterResponse> {
    return this.authService.register(dto);
  }
}
