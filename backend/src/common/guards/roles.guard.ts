import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators';
import { Role } from '../enums';
import type { AuthUser } from '../interfaces';

// Role-based authorization guard.
// Related: PDF section 6.1, ACC-11.
//
// Put it after JwtAuthGuard, which sets request.user, and list the allowed roles with @Roles():
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles(Role.Admin)
// A logged-in account with another role gets 403. Routes without @Roles are not restricted.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!allowed || allowed.length === 0) return true;

    const user = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>().user;
    // Only happens if JwtAuthGuard was forgotten before RolesGuard.
    if (!user) throw new UnauthorizedException('You must be logged in');

    if (!allowed.includes(user.role)) {
      if (allowed.includes(Role.Admin)) {
        throw new ForbiddenException('Not an admin.');
      }
      throw new ForbiddenException('You do not have permission to do this');
    }
    return true;
  }
}
