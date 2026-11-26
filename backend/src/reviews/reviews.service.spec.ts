import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { AccountStatus, BookingStatus, Role } from '../common/enums';
import { AuthUser } from '../common/interfaces';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

const userId = new Types.ObjectId('665f1c2a9b1e8a0012340001');
const hotelId = new Types.ObjectId('665f1c2a9b1e8a0012340002');
const bookingId = new Types.ObjectId('665f1c2a9b1e8a0012340003');
const reviewId = new Types.ObjectId('665f1c2a9b1e8a0012340004');
const session = {};

function query<T>(value: T) {
  const result: Record<string, jest.Mock> = {};
  for (const method of ['session', 'select', 'lean', 'sort', 'skip', 'limit']) {
    result[method] = jest.fn(() => result);
  }
  result.exec = jest.fn().mockResolvedValue(value);
  return result;
}

type UpdateStage = { $set: Record<string, unknown> };

function paginatedQuery<T extends { _id: Types.ObjectId; createdAt: Date }>(
  rows: T[],
) {
  const sortedRows = [...rows];
  let skip = 0;
  let limit = rows.length;
  const result: Record<string, jest.Mock> = {};
  result.sort = jest.fn((sort: Record<string, number>) => {
    if (sort.createdAt === -1) {
      sortedRows.sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          right._id.toString().localeCompare(left._id.toString()),
      );
    }
    return result;
  });
  result.skip = jest.fn((value: number) => {
    skip = value;
    return result;
  });
  result.limit = jest.fn((value: number) => {
    limit = value;
    return result;
  });
  result.lean = jest.fn(() => result);
  result.exec = jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve(sortedRows.slice(skip, skip + limit)),
    );
  return result;
}

function pipelineFrom(updateOne: jest.Mock, callIndex = 0): UpdateStage[] {
  const call = updateOne.mock.calls[callIndex] as unknown[] | undefined;
  const pipeline = call?.[1];
  if (!Array.isArray(pipeline)) {
    throw new Error('Expected an aggregation update pipeline.');
  }
  return pipeline.map((stage: unknown): UpdateStage => {
    if (typeof stage !== 'object' || stage === null || !('$set' in stage)) {
      throw new Error('Expected an aggregation pipeline $set stage.');
    }
    const set = stage.$set;
    if (typeof set !== 'object' || set === null || Array.isArray(set)) {
      throw new Error('Expected a $set object in aggregation pipeline.');
    }
    return { $set: set as Record<string, unknown> };
  });
}

function applyUpdatePipeline(
  initial: Record<string, number>,
  pipeline: UpdateStage[],
): Record<string, number> {
  return pipeline.reduce((document, stage) => {
    const values: Record<string, number> = Object.fromEntries(
      Object.entries(stage.$set).map(([key, expression]) => [
        key,
        evaluateExpression(expression, document),
      ]),
    );
    return { ...document, ...values };
  }, initial);
}

function evaluateExpression(
  expression: unknown,
  document: Record<string, number>,
): number {
  if (typeof expression === 'number') return expression;
  if (typeof expression === 'string' && expression.startsWith('$')) {
    return document[expression.slice(1)] ?? 0;
  }
  if (Array.isArray(expression)) {
    throw new Error('Unexpected aggregation expression array.');
  }
  if (typeof expression !== 'object' || expression === null) {
    throw new Error(
      `Unsupported aggregation expression: ${String(expression)}`,
    );
  }

  const entry = Object.entries(expression)[0] as [string, unknown] | undefined;
  const operator = entry?.[0];
  const rawOperands = entry?.[1];
  const operands = Array.isArray(rawOperands) ? rawOperands : [rawOperands];
  const values = operands.map((operand) =>
    evaluateExpression(operand, document),
  );
  switch (operator) {
    case '$ifNull':
      return (
        evaluateExpression(operands[0], document) ||
        evaluateExpression(operands[1], document)
      );
    case '$add':
      return values.reduce((sum, value) => sum + value, 0);
    case '$multiply':
      return values.reduce((product, value) => product * value, 1);
    case '$divide':
      return values[0] / values[1];
    case '$subtract':
      return values[0] - values[1];
    case '$max':
      return Math.max(...values);
    case '$gt':
      return Number(values[0] > values[1]);
    case '$cond':
      return values[0]
        ? evaluateExpression(operands[1], document)
        : evaluateExpression(operands[2], document);
    default:
      throw new Error(`Unsupported aggregation operator: ${String(operator)}`);
  }
}

function makeReview(overrides: Record<string, unknown> = {}) {
  return {
    _id: reviewId,
    reservation: bookingId,
    user: userId,
    hotel: hotelId,
    rating: 4,
    text: 'Nice stay',
    hidden: false,
    createdAt: new Date('2026-11-01T10:00:00Z'),
    ...overrides,
  };
}

function setup(listRows?: ReturnType<typeof makeReview>[]) {
  const review = makeReview();
  const reviews = listRows ?? [review];
  const booking = {
    _id: bookingId,
    userId,
    hotelId,
    status: BookingStatus.Completed,
  };
  const author = { _id: userId, name: 'Ibrahim', status: AccountStatus.Active };
  const listedQueries: Record<string, jest.Mock>[] = [];
  const models = {
    review: {
      create: jest.fn().mockResolvedValue([review]),
      findById: jest.fn(() => query(review)),
      findOne: jest.fn(() => query(review)),
      findOneAndUpdate: jest.fn(() => query(review)),
      deleteOne: jest.fn(() => query({ deletedCount: 1 })),
      find: jest.fn(() => {
        const listQuery = paginatedQuery(reviews);
        listedQueries.push(listQuery);
        return listQuery;
      }),
      countDocuments: jest.fn(() => query(reviews.length)),
    },
    booking: { findOne: jest.fn(() => query(booking)) },
    hotel: {
      updateOne: jest.fn(() => query({ matchedCount: 1 })),
      findOne: jest.fn(() => query({ averageRating: 4, ratingCount: 1 })),
    },
    user: {
      findById: jest.fn(() => query(author)),
      find: jest.fn(() => query([author])),
    },
    connection: {
      transaction: jest.fn(async (callback: (arg: object) => Promise<void>) =>
        callback(session),
      ),
    },
  };
  const service = new ReviewsService(
    models.review as never,
    models.booking as never,
    models.hotel as never,
    models.user as never,
    models.connection as never,
  );
  return { service, models, review, booking, author, listedQueries };
}

describe('ReviewsService', () => {
  describe('createReview', () => {
    it('creates one review for the authenticated user and updates hotel aggregates in a transaction', async () => {
      const { service, models } = setup();
      const result = await service.createReview(bookingId, userId.toString(), {
        rating: 5,
        text: 'Great',
      });

      expect(models.connection.transaction).toHaveBeenCalledTimes(1);
      expect(models.review.create).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            reservation: bookingId,
            user: userId,
            hotel: hotelId,
            rating: 5,
            hidden: false,
          }),
        ],
        { session },
      );
      expect(models.hotel.updateOne).toHaveBeenCalledWith(
        { _id: hotelId },
        expect.any(Array),
        { session },
      );
      expect(result).toMatchObject({
        id: reviewId.toString(),
        author: { name: 'Ibrahim' },
      });
    });

    it('rejects missing or foreign reservations without creating a review', async () => {
      const { service, models } = setup();
      models.booking.findOne.mockReturnValue(query(null) as never);
      await expect(
        service.createReview(bookingId, userId.toString(), {
          rating: 5,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(models.review.create).not.toHaveBeenCalled();
    });

    it('rejects a reservation that is not completed', async () => {
      const { service, models, booking } = setup();
      booking.status = BookingStatus.Confirmed;
      models.booking.findOne.mockReturnValue(query(booking) as never);
      await expect(
        service.createReview(bookingId, userId.toString(), {
          rating: 5,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(models.review.create).not.toHaveBeenCalled();
    });

    it('maps the unique reservation index conflict to the documented 409', async () => {
      const { service, models } = setup();
      models.review.create.mockRejectedValue({ code: 11000 });
      await expect(
        service.createReview(bookingId, userId.toString(), {
          rating: 5,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(models.hotel.updateOne).not.toHaveBeenCalled();
    });

    it('rejects when the hotel aggregate target is missing inside the transaction', async () => {
      const { service, models } = setup();
      models.hotel.updateOne.mockReturnValue(
        query({ matchedCount: 0 }) as never,
      );
      const dto = { rating: 5 } satisfies CreateReviewDto;
      await expect(
        service.createReview(bookingId, userId.toString(), dto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(models.connection.transaction).toHaveBeenCalledTimes(1);
    });

    it('calculates the first and a subsequent rating aggregate correctly', async () => {
      const { service, models } = setup();
      await service.createReview(bookingId, userId.toString(), { rating: 5 });
      const afterFirst = applyUpdatePipeline(
        { averageRating: 0, ratingCount: 0 },
        pipelineFrom(models.hotel.updateOne),
      );
      expect(afterFirst).toEqual({ averageRating: 5, ratingCount: 1 });

      await service.createReview(new Types.ObjectId(), userId.toString(), {
        rating: 3,
      });
      const afterSecond = applyUpdatePipeline(
        afterFirst,
        pipelineFrom(models.hotel.updateOne, 1),
      );
      expect(afterSecond).toEqual({ averageRating: 4, ratingCount: 2 });
    });
  });

  describe('updateReview and deleteReview', () => {
    it('rejects an empty update and returns 404 for a missing review', async () => {
      const { service, models } = setup();
      await expect(
        service.updateReview(reviewId, userId.toString(), {}),
      ).rejects.toBeInstanceOf(BadRequestException);

      models.review.findById.mockReturnValue(query(null) as never);
      await expect(
        service.updateReview(reviewId, userId.toString(), { rating: 3 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.deleteReview(reviewId, userId.toString()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("updates the author's review and adjusts aggregates only when the rating changes", async () => {
      const { service, models } = setup();
      await service.updateReview(reviewId, userId.toString(), { rating: 5 });
      expect(models.hotel.updateOne).toHaveBeenCalledWith(
        { _id: hotelId },
        expect.any(Array),
        { session },
      );
      expect(
        applyUpdatePipeline(
          { averageRating: 3, ratingCount: 2 },
          pipelineFrom(models.hotel.updateOne),
        ),
      ).toEqual({ averageRating: 3.5, ratingCount: 2 });
    });

    it('does not change hotel aggregates when only review text changes', async () => {
      const { service, models } = setup();
      await service.updateReview(reviewId, userId.toString(), {
        text: 'Updated text',
      });
      expect(models.hotel.updateOne).not.toHaveBeenCalled();
    });

    it('does not allow another user to update or delete a review', async () => {
      const { service } = setup();
      const otherUser = new Types.ObjectId().toString();
      await expect(
        service.updateReview(reviewId, otherUser, { rating: 3 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.deleteReview(reviewId, otherUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('deletes a review and updates the hotel aggregate in the same transaction', async () => {
      const { service, models } = setup();
      await expect(
        service.deleteReview(reviewId, userId.toString()),
      ).resolves.toBeUndefined();
      expect(models.review.deleteOne).toHaveBeenCalledWith({
        _id: reviewId,
        user: userId,
      });
      expect(models.hotel.updateOne).toHaveBeenCalledWith(
        { _id: hotelId },
        expect.any(Array),
        { session },
      );
      expect(
        applyUpdatePipeline(
          { averageRating: 3, ratingCount: 3 },
          pipelineFrom(models.hotel.updateOne),
        ),
      ).toEqual({ averageRating: 2.5, ratingCount: 2 });
    });

    it('resets aggregates to zero when deleting the final review', async () => {
      const { service, models } = setup();
      await service.deleteReview(reviewId, userId.toString());
      expect(
        applyUpdatePipeline(
          { averageRating: 4, ratingCount: 1 },
          pipelineFrom(models.hotel.updateOne),
        ),
      ).toEqual({ averageRating: 0, ratingCount: 0 });
    });
  });

  // HTL-23: the reservation details (GET /api/hotel-bookings/:id) show the user's own review so
  // P-23 can offer edit / delete after a reload.
  describe('findForReservation', () => {
    it("returns the user's review of that reservation with its hidden flag", async () => {
      const { service, models } = setup();
      models.review.findOne.mockReturnValue(
        query(
          makeReview({
            hidden: true,
            reply: {
              text: 'Thanks!',
              createdAt: new Date('2026-11-02T09:00:00Z'),
            },
          }),
        ) as never,
      );

      const result = await service.findForReservation(
        bookingId.toString(),
        userId.toString(),
      );

      expect(models.review.findOne).toHaveBeenCalledWith({
        reservation: bookingId,
        user: userId,
      });
      expect(result).toEqual({
        id: reviewId.toString(),
        rating: 4,
        text: 'Nice stay',
        author: { name: 'Ibrahim' },
        date: new Date('2026-11-01T10:00:00Z'),
        reply: { text: 'Thanks!', date: new Date('2026-11-02T09:00:00Z') },
        hidden: true,
      });
    });

    it('returns null when the reservation has no review', async () => {
      const { service, models } = setup();
      models.review.findOne.mockReturnValue(query(null) as never);

      await expect(
        service.findForReservation(bookingId.toString(), userId.toString()),
      ).resolves.toBeNull();
      expect(models.user.findById).not.toHaveBeenCalled();
    });

    it('returns text null when the review has no text', async () => {
      const { service, models } = setup();
      models.review.findOne.mockReturnValue(
        query(makeReview({ text: undefined })) as never,
      );

      const result = await service.findForReservation(
        bookingId.toString(),
        userId.toString(),
      );

      expect(result).toMatchObject({ text: null, hidden: false, reply: null });
    });
  });

  describe('listHotelReviews', () => {
    it('returns newest-first paginated public reviews and replaces deactivated authors with Deleted user', async () => {
      const { service, models, review, listedQueries } = setup();
      const deactivated = {
        _id: userId,
        name: 'Private Name',
        status: AccountStatus.Deactivated,
      };
      models.user.find.mockReturnValue(query([deactivated]) as never);
      const result = await service.listHotelReviews(hotelId, 1);

      expect(models.review.find).toHaveBeenCalledWith({
        hotel: hotelId,
        hidden: false,
      });
      expect(models.review.countDocuments).toHaveBeenCalledWith({
        hotel: hotelId,
        hidden: false,
      });
      expect(listedQueries[0].sort).toHaveBeenCalledWith({
        createdAt: -1,
        _id: -1,
      });
      expect(listedQueries[0].skip).toHaveBeenCalledWith(0);
      expect(listedQueries[0].limit).toHaveBeenCalledWith(10);
      expect(result).toMatchObject({
        averageRating: 4,
        ratingCount: 1,
        page: 1,
        pageSize: 10,
        total: 1,
        items: [
          { id: review._id.toString(), author: { name: 'Deleted user' } },
        ],
      });
    });

    it('allows a review author to see their hidden review and admins to see all hidden reviews', async () => {
      const { service, models } = setup();
      const authorViewer = {
        id: userId.toString(),
        role: Role.User,
      } as AuthUser;
      await service.listHotelReviews(hotelId, 1, authorViewer);
      expect(models.review.find).toHaveBeenLastCalledWith({
        hotel: hotelId,
        $or: [{ hidden: false }, { hidden: true, user: userId }],
      });

      const adminViewer = {
        id: new Types.ObjectId().toString(),
        role: Role.Admin,
      } as AuthUser;
      await service.listHotelReviews(hotelId, 1, adminViewer);
      expect(models.review.find).toHaveBeenLastCalledWith({ hotel: hotelId });
    });

    // source: Excel GEN-10 - admins hide content; hidden content stays visible to its author and admins.
    // Team leader (26 Nov): each listed review says whether it is hidden, so P-18 can mark it and offer Unhide.
    it('marks each listed review as hidden or not', async () => {
      const hiddenId = new Types.ObjectId();
      const { service } = setup([
        makeReview(),
        // older than makeReview()'s 1 Nov, so it comes second (newest first)
        makeReview({
          _id: hiddenId,
          hidden: true,
          createdAt: new Date('2026-10-01T10:00:00Z'),
        }),
      ]);
      const admin = {
        id: new Types.ObjectId().toString(),
        role: Role.Admin,
      } as AuthUser;

      const result = await service.listHotelReviews(hotelId, 1, admin);

      expect(result.items.map((item) => [item.id, item.hidden])).toEqual([
        [reviewId.toString(), false],
        [hiddenId.toString(), true],
      ]);
    });

    it('does not include another regular user’s hidden reviews in the viewer filter', async () => {
      const { service, models } = setup();
      const otherViewer = new Types.ObjectId();
      await service.listHotelReviews(hotelId, 1, {
        id: otherViewer.toString(),
        role: Role.User,
      } as AuthUser);
      expect(models.review.find).toHaveBeenCalledWith({
        hotel: hotelId,
        $or: [{ hidden: false }, { hidden: true, user: otherViewer }],
      });
    });

    it('returns exactly ten results per page and an empty page beyond the last page', async () => {
      const rows = Array.from({ length: 21 }, (_, index) =>
        makeReview({
          _id: new Types.ObjectId(),
          rating: (index % 5) + 1,
          createdAt: new Date(Date.UTC(2026, 10, 10, 0, 0, 21 - index)),
        }),
      );
      const { service } = setup(rows);
      const first = await service.listHotelReviews(hotelId, 1);
      const second = await service.listHotelReviews(hotelId, 2);
      const third = await service.listHotelReviews(hotelId, 3);
      const beyondLast = await service.listHotelReviews(hotelId, 4);

      expect(first.items).toHaveLength(10);
      expect(second.items).toHaveLength(10);
      expect(third.items).toHaveLength(1);
      expect(beyondLast.items).toEqual([]);
      expect(first.total).toBe(21);
      expect(first.totalPages).toBe(3);
      expect(first.items[0].date.getTime()).toBeGreaterThan(
        first.items[1].date.getTime(),
      );
      expect(beyondLast).toMatchObject({ page: 4, total: 21, totalPages: 3 });
    });

    it('returns not found for missing or inactive hotels', async () => {
      const { service, models } = setup();
      models.hotel.findOne.mockReturnValue(query(null) as never);
      await expect(service.listHotelReviews(hotelId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns an empty standard pagination envelope when there are no visible reviews', async () => {
      const { service, models } = setup();
      models.review.find.mockReturnValue(query([]) as never);
      models.review.countDocuments.mockReturnValue(query(0) as never);

      await expect(service.listHotelReviews(hotelId)).resolves.toMatchObject({
        averageRating: 4,
        ratingCount: 1,
        items: [],
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 0,
      });
      expect(models.user.find).not.toHaveBeenCalled();
    });
  });
});
