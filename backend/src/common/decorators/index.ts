import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
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
