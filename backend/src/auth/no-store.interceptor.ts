import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';

// Area: Auth & Accounts
// ACC-19: responses about the logged-in account (login, /auth/me, the profile...) must not be kept
// by the browser cache or a proxy, the same way tokens are never kept in JavaScript-accessible
// storage. The header is set before the handler runs, so error responses from the handler get it
// too.
//
// Use it on a whole controller:  @UseInterceptors(NoStoreInterceptor)
@Injectable()
export class NoStoreInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<Response>();
    res.setHeader('Cache-Control', 'no-store');
    return next.handle();
  }
}
