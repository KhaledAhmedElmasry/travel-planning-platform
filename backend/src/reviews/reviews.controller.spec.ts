import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Types } from 'mongoose';
import type { Request } from 'express';
jest.mock('../common/guards/auth.guard', () => ({ JwtAuthGuard: class {} }));
jest.mock('../common/guards/roles.guard', () => ({ RolesGuard: class {} }));
jest.mock('../auth/sessions.service', () => ({ SessionsService: class {} }));
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ROLES_KEY } from '../common/decorators';
import { Role } from '../common/enums';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto';
import { ReviewsController } from './reviews.controller';

describe('ReviewsController route access', () => {
  it('keeps public hotel review browsing unguarded', () => {
    const method = Object.getOwnPropertyDescriptor(
      ReviewsController.prototype,
      'listHotelReviews',
    )?.value as object;
    expect(Reflect.getMetadata(PATH_METADATA, method)).toBe(
      'hotels/:id/reviews',
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, method)).toBeUndefined();
  });

  it.each([
    ['createReview', 'hotel-bookings/:id/review'],
    ['updateReview', 'reviews/:id'],
    ['deleteReview', 'reviews/:id'],
  ])('%s requires authentication and role checks', (methodName, path) => {
    const method = Object.getOwnPropertyDescriptor(
      ReviewsController.prototype,
      methodName,
    )?.value as object;
    expect(Reflect.getMetadata(PATH_METADATA, method)).toBe(path);
    expect(Reflect.getMetadata(GUARDS_METADATA, method)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, method)).toEqual([Role.User]);
  });

  it('serves public listing without attempting authentication when there is no cookie', async () => {
    const service = {
      listHotelReviews: jest.fn().mockResolvedValue({ items: [] }),
    };
    const sessions = { authenticate: jest.fn() };
    const controller = new ReviewsController(
      service as never,
      sessions as never,
    );
    const request = { cookies: {} } as Request;
    const hotelId = new Types.ObjectId();

    await controller.listHotelReviews(
      hotelId,
      new ListReviewsQueryDto(),
      request,
    );

    expect(sessions.authenticate).not.toHaveBeenCalled();
    expect(service.listHotelReviews).toHaveBeenCalledWith(
      hotelId,
      1,
      undefined,
    );
  });

  it.each([
    ['expired', new UnauthorizedException('Session expired')],
    ['invalid', new UnauthorizedException('Invalid session')],
    ['forbidden', new ForbiddenException('Account deactivated')],
  ])(
    'keeps public listing available with an %s access cookie',
    async (_label, error) => {
      const service = {
        listHotelReviews: jest.fn().mockResolvedValue({ items: [] }),
      };
      const sessions = { authenticate: jest.fn().mockRejectedValue(error) };
      const controller = new ReviewsController(
        service as never,
        sessions as never,
      );
      const request = {
        cookies: { access_token: 'opaque-test-cookie' },
      } as unknown as Request;
      const hotelId = new Types.ObjectId();

      await expect(
        controller.listHotelReviews(
          hotelId,
          new ListReviewsQueryDto(),
          request,
        ),
      ).resolves.toEqual({ items: [] });
      expect(service.listHotelReviews).toHaveBeenCalledWith(
        hotelId,
        1,
        undefined,
      );
    },
  );

  it('does not swallow unexpected authentication-service failures', async () => {
    const failure = new Error('Authentication service unavailable');
    const service = { listHotelReviews: jest.fn() };
    const sessions = { authenticate: jest.fn().mockRejectedValue(failure) };
    const controller = new ReviewsController(
      service as never,
      sessions as never,
    );
    const request = {
      cookies: { access_token: 'opaque-test-cookie' },
    } as unknown as Request;

    await expect(
      controller.listHotelReviews(
        new Types.ObjectId(),
        new ListReviewsQueryDto(),
        request,
      ),
    ).rejects.toBe(failure);
    expect(service.listHotelReviews).not.toHaveBeenCalled();
  });
});
