import 'reflect-metadata';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { BlogController } from './blog.controller';
import { ROLES_KEY } from '../common/decorators';
import { Role } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

describe('BlogController BLG-03 access', () => {
  const handler = Object.getOwnPropertyDescriptor(
    BlogController.prototype,
    'listMyPosts',
  )?.value as object;

  it('requires a logged-in registered user', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[];
    const roles = Reflect.getMetadata(ROLES_KEY, handler) as Role[];

    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    expect(roles).toEqual([Role.User]);
  });

  it('returns 401 from the shared auth guard without a session cookie', async () => {
    const sessions = { authenticate: jest.fn() };
    const guard = new JwtAuthGuard(sessions as never, new Reflector());
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ cookies: {} }) }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(sessions.authenticate).not.toHaveBeenCalled();
  });

  it('returns 403 when an authenticated non-user role calls the route', () => {
    const reflector = new Reflector();
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: () => handler,
      getClass: () => BlogController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: Role.Admin } }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
