/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException } from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Role } from '../common/enums';
import { ROLES_KEY } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BlogController } from './blog.controller';

describe('BlogController batch routes', () => {
  it('derives post ownership from the authenticated user, not request data', async () => {
    const blogService = {
      updatePost: jest.fn().mockResolvedValue({ id: 'post' }),
    };
    const controller = new BlogController(blogService as never);
    const postId = new Types.ObjectId();
    const sessionUser = {
      id: new Types.ObjectId().toString(),
      role: Role.User,
    };

    await controller.updatePost(postId, sessionUser, { title: 'changed' });

    expect(blogService.updatePost).toHaveBeenCalledWith(
      postId,
      sessionUser.id,
      { title: 'changed' },
    );
  });

  it('protects mutations with JWT and registered-user role guards', () => {
    for (const getHandler of [
      () => BlogController.prototype.updatePost,
      () => BlogController.prototype.deletePost,
      () => BlogController.prototype.likePost,
      () => BlogController.prototype.unlikePost,
      () => BlogController.prototype.createComment,
      () => BlogController.prototype.updateComment,
      () => BlogController.prototype.deleteComment,
    ]) {
      expect(Reflect.getMetadata('__guards__', getHandler())).toEqual([
        JwtAuthGuard,
        RolesGuard,
      ]);
      expect(Reflect.getMetadata(ROLES_KEY, getHandler())).toEqual([Role.User]);
    }
  });

  it('leaves public post search unguarded for guest requests', () => {
    expect(
      Reflect.getMetadata('__guards__', BlogController.prototype.listPosts),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(ROLES_KEY, BlogController.prototype.listPosts),
    ).toBeUndefined();
  });

  it('uses the shared ObjectId pipe and rejects malformed post ids', () => {
    const pipe = new ParseObjectIdPipe();
    expect(() =>
      pipe.transform('not-an-object-id', {
        type: 'param',
        data: 'id',
        metatype: Types.ObjectId,
      }),
    ).toThrow(BadRequestException);
  });
});
