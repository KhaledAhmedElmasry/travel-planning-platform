import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ACCESS_COOKIE } from '../../auth/auth-cookies';
import { SessionsService } from '../../auth/sessions.service';
import type { AuthUser } from '../interfaces';

// Authentication guard: reads the access token from the httpOnly cookie.
// Related: ACC-04, ACC-06, ACC-19, NEW-07.
// Restricted actions by a guest (book, review, post, like, comment, report) must return 401, so the
// frontend can send the guest to login and back to the action (ACC-10).
//
// Use it on any route that needs a logged-in account, in any module (AuthModule is global):
//   @UseGuards(JwtAuthGuard)
// It answers 401 without a valid session and 403 for a suspended account, and sets request.user
// (read it with @CurrentUser()).
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const cookies = request.cookies as Record<string, string> | undefined;
    const token = cookies?.[ACCESS_COOKIE];
    if (!token) throw new UnauthorizedException('You must be logged in');

    request.user = await this.sessions.authenticate(token);
    return true;
  }
}
