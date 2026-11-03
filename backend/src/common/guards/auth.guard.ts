import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ACCESS_COOKIE } from '../../auth/auth-cookies';
import { SessionsService } from '../../auth/sessions.service';
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY } from '../decorators';
import type { AuthUser } from '../interfaces';

// Authentication guard: reads the access token from the httpOnly cookie.
// Related: ACC-04, ACC-06, ACC-19, NEW-07.
// Restricted actions by a guest (book, review, post, like, comment, report) must return 401, so the
// frontend can send the guest to login and back to the action (ACC-10).
//
// Use it on any route that needs a logged-in account, in any module (AuthModule is global):
//   @UseGuards(JwtAuthGuard)
// It answers 401 without a valid session and 403 for a suspended account, and sets request.user
// (read it with @CurrentUser()). An account with a temporary password (ACC-07a, ACC-13) gets 403
// on every route not marked with @AllowPendingPasswordChange().
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const cookies = request.cookies as Record<string, string> | undefined;
    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : undefined;
    const token = cookies?.[ACCESS_COOKIE] || bearerToken;
    if (!token) throw new UnauthorizedException('You must be logged in');

    const user = await this.sessions.authenticate(token);

    if (user.mustChangePassword) {
      const allowed = this.reflector.getAllAndOverride<boolean | undefined>(
        ALLOW_PENDING_PASSWORD_CHANGE_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (!allowed) {
        throw new ForbiddenException(
          'You must change your temporary password before continuing',
        );
      }
    }

    request.user = user;
    return true;
  }
}
