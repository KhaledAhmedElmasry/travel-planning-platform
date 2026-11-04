import { GUARDS_METADATA } from '@nestjs/common/constants';
import { BlogController } from './blog.controller';
import { ROLES_KEY } from '../common/decorators';
import { Role } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

describe('BlogController BLG-08 access contract', () => {
  it('requires an authenticated registered user for post tag updates', () => {
    const handler = Object.getOwnPropertyDescriptor(
      BlogController.prototype,
      'updatePost',
    )?.value as object;
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[];
    const roles = Reflect.getMetadata(ROLES_KEY, handler) as Role[];

    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    expect(roles).toEqual([Role.User]);
  });

  it('keeps browsing posts by tag public for guests', () => {
    const handler = Object.getOwnPropertyDescriptor(
      BlogController.prototype,
      'listPostsByTag',
    )?.value as object;
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toBeUndefined();
  });
});
