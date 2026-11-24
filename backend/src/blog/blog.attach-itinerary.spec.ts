import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Types } from 'mongoose';
import { SessionsService } from '../auth/sessions.service';
import { ROLES_KEY } from '../common/decorators';
import { Role } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';

const postId = new Types.ObjectId('665f1c2a9b1e8a0012340001');
const authorId = new Types.ObjectId('665f1c2a9b1e8a0012345678');
const firstItineraryId = '665f1c2a9b1e8a0012341111';
const replacementItineraryId = '665f1c2a9b1e8a0012342222';

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    _id: postId,
    author: authorId,
    title: 'Cairo in a weekend',
    body: 'A practical two-day guide.',
    status: 'published',
    tags: ['cairo'],
    itinerary: undefined as Types.ObjectId | null | undefined,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeBlogService(post: ReturnType<typeof makePost> | null) {
  const query = { exec: jest.fn().mockResolvedValue(post) };
  const postModel = { findById: jest.fn().mockReturnValue(query) };
  const itinerariesService = {
    getOne: jest
      .fn()
      .mockResolvedValue({ id: firstItineraryId, visibility: 'private' }),
  };
  const service = Object.assign(
    Object.create(BlogService.prototype) as object,
    { postModel, itinerariesService },
  ) as unknown as BlogService;

  return { service, postModel, itinerariesService, query };
}

describe('BLG-13 attach itinerary to post', () => {
  it('attaches an owned itinerary and returns only the post and itinerary ids', async () => {
    const post = makePost();
    const { service, itinerariesService } = makeBlogService(post);

    await expect(
      service.attachItinerary(postId, authorId.toString(), firstItineraryId),
    ).resolves.toEqual({
      id: postId.toString(),
      itineraryId: firstItineraryId,
    });

    expect(itinerariesService.getOne).toHaveBeenCalledWith(
      firstItineraryId,
      authorId.toString(),
    );
    expect(post.itinerary?.toString()).toBe(firstItineraryId);
    expect(post.save).toHaveBeenCalledTimes(1);
    expect(post).toMatchObject({
      title: 'Cairo in a weekend',
      body: 'A practical two-day guide.',
      tags: ['cairo'],
    });
  });

  it('replaces an existing itinerary with another owned itinerary', async () => {
    const post = makePost({
      itinerary: new Types.ObjectId(firstItineraryId),
    });
    const { service, itinerariesService } = makeBlogService(post);

    await expect(
      service.attachItinerary(
        postId,
        authorId.toString(),
        replacementItineraryId,
      ),
    ).resolves.toEqual({
      id: postId.toString(),
      itineraryId: replacementItineraryId,
    });

    expect(itinerariesService.getOne).toHaveBeenCalledWith(
      replacementItineraryId,
      authorId.toString(),
    );
    expect(post.itinerary?.toString()).toBe(replacementItineraryId);
  });

  it('detaches with null without looking up an itinerary and preserves other post fields', async () => {
    const post = makePost({ itinerary: new Types.ObjectId(firstItineraryId) });
    const { service, itinerariesService } = makeBlogService(post);

    await expect(
      service.attachItinerary(postId, authorId.toString(), null),
    ).resolves.toEqual({ id: postId.toString(), itineraryId: null });

    expect(itinerariesService.getOne).not.toHaveBeenCalled();
    expect(post.itinerary).toBeNull();
    expect(post.save).toHaveBeenCalledTimes(1);
    expect(post).toMatchObject({
      title: 'Cairo in a weekend',
      body: 'A practical two-day guide.',
      tags: ['cairo'],
    });
  });

  it('returns 404 for a missing post and 403 for a post owned by another user', async () => {
    const missing = makeBlogService(null).service;
    await expect(
      missing.attachItinerary(postId, authorId.toString(), firstItineraryId),
    ).rejects.toBeInstanceOf(NotFoundException);

    const otherUserId = new Types.ObjectId().toString();
    const post = makePost();
    const { service, itinerariesService } = makeBlogService(post);
    await expect(
      service.attachItinerary(postId, otherUserId, firstItineraryId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(itinerariesService.getOne).not.toHaveBeenCalled();
    expect(post.save).not.toHaveBeenCalled();
  });

  it('does not save when the itinerary lookup reports missing or non-owned data', async () => {
    const post = makePost();
    const { service, itinerariesService } = makeBlogService(post);
    itinerariesService.getOne.mockRejectedValue(
      new NotFoundException('Itinerary not found.'),
    );

    await expect(
      service.attachItinerary(postId, authorId.toString(), firstItineraryId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(post.save).not.toHaveBeenCalled();
  });

  it('delegates using the authenticated user id and requires a registered user role', async () => {
    const response = { id: postId.toString(), itineraryId: firstItineraryId };
    const blogService = {
      attachItinerary: jest.fn().mockResolvedValue(response),
    };
    const controller = new BlogController(
      blogService as unknown as BlogService,
      {} as never,
      { post: jest.fn() } as never, // B5 revalidation, not under test here
    );
    const user = {
      id: authorId.toString(),
      role: Role.User,
      sessionId: 'session-id',
      airlineId: null,
      hotelId: null,
      mustChangePassword: false,
      emailVerified: true,
    };

    await expect(
      controller.attachItinerary(postId, user, {
        itineraryId: firstItineraryId,
      }),
    ).resolves.toBe(response);

    expect(blogService.attachItinerary).toHaveBeenCalledWith(
      postId,
      authorId.toString(),
      firstItineraryId,
    );
    const handler = Object.getOwnPropertyDescriptor(
      BlogController.prototype,
      'attachItinerary',
    )?.value as object;
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(
      'posts/:id/itinerary',
    );
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([Role.User]);
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
  });

  it('returns 401 without a session and 403 for a non-user role', async () => {
    const handler = Object.getOwnPropertyDescriptor(
      BlogController.prototype,
      'attachItinerary',
    )?.value as object;
    const request: { cookies?: Record<string, string>; user?: object } = {
      cookies: {},
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => handler,
      getClass: () => BlogController,
    } as unknown as ExecutionContext;
    const sessions = {
      authenticate: jest.fn().mockResolvedValue({
        id: new Types.ObjectId().toString(),
        role: Role.HotelModerator,
        mustChangePassword: false,
        emailVerified: true,
      }),
    };
    const reflector = {
      getAllAndOverride: jest.fn((key: string) =>
        key === ROLES_KEY ? [Role.User] : undefined,
      ),
    };
    const authGuard = new JwtAuthGuard(
      sessions as unknown as SessionsService,
      reflector as unknown as Reflector,
    );
    const rolesGuard = new RolesGuard(reflector as unknown as Reflector);

    await expect(authGuard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    request.cookies = { access_token: 'valid-session-token' };
    await expect(authGuard.canActivate(context)).resolves.toBe(true);
    expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
  });
});
