import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '../common/enums';
import type { AuthUser } from '../common/interfaces';

// Area: Payments, Holds & Booking Engine
// Booking, paying, accepting policies and cancelling are Registered User actions (PDF section 4,
// PAY-01, PAY-02, FLT-22, HTL-16): admins and moderators get 403. Use it AFTER JwtAuthGuard, which
// answers 401 for guests and puts the account on request.user:
//   @UseGuards(JwtAuthGuard, RegisteredUserGuard)
// Replace it with Area 2's role guard (common/guards/roles.guard.ts, ACC-11) once that exists.
@Injectable()
export class RegisteredUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    if (user?.role !== Role.User) {
      throw new ForbiddenException(
        'Only registered users can book, pay and cancel',
      );
    }
    return true;
  }
}
