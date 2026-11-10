import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Role } from '../enums';
import type { AuthUser } from '../interfaces';

// Shared decorators, e.g. marking public routes, required roles, and the current user.
// Related: PDF section 6.1 (role-based authorization), ACC-11.

// The logged-in account (ACC-04, ACC-11). Use it on routes protected by JwtAuthGuard:
//   @UseGuards(JwtAuthGuard)
//   @Get('me')
//   me(@CurrentUser() user: AuthUser) { ... user.id ... }
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: AuthUser }>();
    return request.user;
  },
);

// The roles allowed on a route or a whole controller (PDF section 6.1, ACC-11). Works with
// RolesGuard, after JwtAuthGuard:
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles(Role.Admin)
// Any other role gets 403. A route without @Roles is open to every logged-in account.
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

// ACC-07a, ACC-13: an account with a temporary password may only use the routes marked with this
// decorator (read the account, log out, change the password). JwtAuthGuard answers 403 everywhere
// else until the password is changed.
export const ALLOW_PENDING_PASSWORD_CHANGE_KEY = 'allowPendingPasswordChange';
export const AllowPendingPasswordChange = () =>
  SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE_KEY, true);

// ACC-02 (bonus): routes that need a verified email address, e.g. creating a booking. JwtAuthGuard
// answers 403 for an account that has not opened its verification link yet.
//   @UseGuards(JwtAuthGuard)
//   @RequireVerifiedEmail()
export const REQUIRE_VERIFIED_EMAIL_KEY = 'requireVerifiedEmail';
export const RequireVerifiedEmail = () =>
  SetMetadata(REQUIRE_VERIFIED_EMAIL_KEY, true);
