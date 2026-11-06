import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { AllowPendingPasswordChange, CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import type { AuthUser } from '../common/interfaces';
import { clearAuthCookies, setAuthCookies } from './auth-cookies';
import {
  AccountResponse,
  AuthService,
  ChangePasswordResponse,
  MeResponse,
  RegisterResponse,
} from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { NoStoreInterceptor } from './no-store.interceptor';

// Area: Auth & Accounts
// Requirements: ACC-01, ACC-03, ACC-04, ACC-05, ACC-06, ACC-08, ACC-19, NEW-07
// Endpoints to implement (PDF section 8):
//   POST  /api/auth/register          ACC-01, ACC-03   done
//   POST  /api/auth/login             ACC-04, ACC-05   done
//   POST  /api/auth/logout            ACC-06           done
//   PATCH /api/auth/change-password   ACC-08           done
//   GET   /api/auth/me                ACC-04, ACC-11   done
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
// DONE (Area 3, GEN-02 / GEN-13): the global ValidationPipe and error filter are registered in main.ts.
// ACC-19: account data is never cached by the browser or a proxy.
@UseInterceptors(NoStoreInterceptor)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ACC-01, ACC-03: public, guests register without logging in. A role in the body is stripped.
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto): Promise<RegisterResponse> {
    return this.authService.register(dto);
  }

  // ACC-04: public. Sets the access_token and refresh_token httpOnly cookies (ACC-19, NEW-07)
  // and returns the account; the frontend opens the home page of the returned role.
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccountResponse> {
    const { account, tokens } = await this.authService.login(dto);
    setAuthCookies(res, tokens);
    return account;
  }

  // ACC-06: revokes the session on the server and clears both cookies. Its tokens stop working
  // at once, even if they have not expired yet. Other sessions of the account stay logged in.
  // Allowed with a temporary password (ACC-07a), so the account can still log out.
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @AllowPendingPasswordChange()
  async logout(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(user.sessionId);
    clearAuthCookies(res);
  }

  // ACC-08: change the own password with the current one. Allowed with a temporary password
  // (ACC-07a, ACC-13): this is how such an account gets unblocked.
  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @AllowPendingPasswordChange()
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<ChangePasswordResponse> {
    return this.authService.changePassword(user, dto);
  }

  // ACC-04, ACC-19: the frontend reads the logged-in account here instead of storing it.
  // Allowed with a temporary password (ACC-07a), so the frontend can see mustChangePassword.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @AllowPendingPasswordChange()
  me(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    return this.authService.me(user.id);
  }
}
