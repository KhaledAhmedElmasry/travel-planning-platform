import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { BookingStatus, AccountStatus, Role } from '../common/enums';
import {
  DEFAULT_PAGE_SIZE,
  getPaginationOffset,
  PaginatedList,
  paginate,
} from '../common/dto/pagination.dto';
import type { AuthUser } from '../common/interfaces';
import { HotelBooking } from '../hotel-bookings/schemas/hotel-booking.schema';
import { Hotel } from '../hotels/schemas/hotel.schema';
import { User } from '../users/schemas/user.schema';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { Review, ReviewDocument } from './schemas/review.schema';

export interface ReviewResponse {
  id: string;
  rating: number;
  text: string | null;
  author: { name: string };
  date: Date;
  // HTL-26 (bonus): the hotel's reply, null while there is none.
  reply: { text: string; date: Date } | null;
}

export interface HotelReviewsResponse extends PaginatedList<ReviewResponse> {
  averageRating: number;
  ratingCount: number;
}

interface ReviewAuthor {
  _id: Types.ObjectId;
  name: string;
  status: AccountStatus;
}

interface LeanReview {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  rating: number;
  text?: string;
  reply?: { text: string; createdAt: Date };
  createdAt?: Date;
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(HotelBooking.name)
    private readonly bookingModel: Model<HotelBooking>,
    @InjectModel(Hotel.name) private readonly hotelModel: Model<Hotel>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async createReview(
    reservationId: Types.ObjectId,
    userId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewResponse> {
    const userObjectId = new Types.ObjectId(userId);
    let createdReview: ReviewDocument | undefined;

    try {
      await this.connection.transaction(async (session) => {
        const booking = await this.bookingModel
          .findOne({ _id: reservationId, userId: userObjectId })
          .session(session)
          .exec();
        if (!booking) {
          throw new NotFoundException(
            'Reservation not found, or it belongs to another user.',
          );
        }
        if (booking.status !== BookingStatus.Completed) {
          throw new ConflictException(
            'The reservation is not Completed, or it already has a review.',
          );
        }

        const [review] = await this.reviewModel.create(
          [
            {
              reservation: reservationId,
              user: userObjectId,
              hotel: booking.hotelId,
              rating: dto.rating,
              text: dto.text,
              hidden: false,
            },
          ],
          { session },
        );
        createdReview = review;

        const aggregateUpdate = await this.hotelModel
          .updateOne({ _id: booking.hotelId }, addRatingPipeline(dto.rating), {
            session,
          })
          .exec();
        if (aggregateUpdate.matchedCount !== 1) {
          throw new NotFoundException('Hotel not found.');
        }
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException(
          'The reservation is not Completed, or it already has a review.',
        );
      }
      throw error;
    }

    if (!createdReview) throw new Error('Review creation did not complete.');
    return this.toResponse(
      createdReview,
      await this.findAuthorName(userObjectId),
    );
  }

  async updateReview(
    reviewId: Types.ObjectId,
    userId: string,
    dto: UpdateReviewDto,
  ): Promise<ReviewResponse> {
    if (dto.rating === undefined && dto.text === undefined) {
      throw new BadRequestException(
        'At least one review field must be provided.',
      );
    }

    const userObjectId = new Types.ObjectId(userId);
    let updatedReview: ReviewDocument | null = null;

    await this.connection.transaction(async (session) => {
      const existing = await this.reviewModel
        .findById(reviewId)
        .session(session)
        .exec();
      if (!existing) throw new NotFoundException('Review not found.');
      if (existing.user.toString() !== userId) {
        throw new ForbiddenException('Not the author of this review.');
      }

      const changes: Partial<Pick<Review, 'rating' | 'text'>> = {};
      if (dto.rating !== undefined) changes.rating = dto.rating;
      if (dto.text !== undefined) changes.text = dto.text;
      updatedReview = await this.reviewModel
        .findOneAndUpdate(
          { _id: reviewId, user: userObjectId },
          { $set: changes },
          { session, new: true, runValidators: true },
        )
        .exec();
      if (!updatedReview) throw new NotFoundException('Review not found.');

      if (dto.rating !== undefined && dto.rating !== existing.rating) {
        const aggregateUpdate = await this.hotelModel
          .updateOne(
            { _id: existing.hotel },
            changeRatingPipeline(dto.rating - existing.rating),
            { session },
          )
          .exec();
        if (aggregateUpdate.matchedCount !== 1) {
          throw new NotFoundException('Hotel not found.');
        }
      }
    });

    if (!updatedReview) throw new NotFoundException('Review not found.');
    return this.toResponse(
      updatedReview,
      await this.findAuthorName(userObjectId),
    );
  }

  async deleteReview(reviewId: Types.ObjectId, userId: string): Promise<void> {
    await this.connection.transaction(async (session) => {
      const review = await this.reviewModel
        .findById(reviewId)
        .session(session)
        .exec();
      if (!review) throw new NotFoundException('Review not found.');
      if (review.user.toString() !== userId) {
        throw new ForbiddenException('Not the author of this review.');
      }

      const result = await this.reviewModel
        .deleteOne({ _id: reviewId, user: new Types.ObjectId(userId) })
        .session(session)
        .exec();
      if (result.deletedCount !== 1) {
        throw new NotFoundException('Review not found.');
      }

      const aggregateUpdate = await this.hotelModel
        .updateOne({ _id: review.hotel }, removeRatingPipeline(review.rating), {
          session,
        })
        .exec();
      if (aggregateUpdate.matchedCount !== 1) {
        throw new NotFoundException('Hotel not found.');
      }
    });
  }

  // HTL-26 (bonus): the moderator of the reviewed hotel answers a review, once.
  // The reply is written by one conditional update (only while the review has
  // no reply and is not hidden), so two replies at the same moment give one
  // 201 and one 409.
  async replyToReview(
    reviewId: Types.ObjectId,
    moderator: { id: string; hotelId?: string | null },
    dto: ReplyReviewDto,
  ): Promise<ReviewResponse> {
    const review = await this.reviewModel
      .findOne({ _id: reviewId, hidden: false })
      .exec();
    if (!review) throw new NotFoundException('Review not found.');
    if (!moderator.hotelId || review.hotel.toString() !== moderator.hotelId) {
      throw new ForbiddenException('Not the moderator of the reviewed hotel.');
    }

    const updated = await this.reviewModel
      .findOneAndUpdate(
        { _id: reviewId, hidden: false, reply: { $exists: false } },
        {
          $set: {
            reply: {
              text: dto.text,
              moderator: new Types.ObjectId(moderator.id),
              createdAt: new Date(),
            },
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updated) {
      const still = await this.reviewModel.exists({
        _id: reviewId,
        hidden: false,
      });
      if (!still) throw new NotFoundException('Review not found.');
      throw new ConflictException('The review already has a reply.');
    }
    return this.toResponse(updated, await this.findAuthorName(updated.user));
  }

  async listHotelReviews(
    hotelId: Types.ObjectId,
    page = 1,
    viewer?: AuthUser,
  ): Promise<HotelReviewsResponse> {
    const hotel = await this.hotelModel
      .findOne({ _id: hotelId, active: { $ne: false } })
      .select('averageRating ratingCount')
      .lean<{ averageRating?: number; ratingCount?: number }>()
      .exec();
    if (!hotel) throw new NotFoundException('Hotel not found.');

    const filter: Record<string, unknown> = { hotel: hotelId };
    if (viewer?.role !== Role.Admin) {
      if (viewer) {
        filter.$or = [
          { hidden: false },
          { hidden: true, user: new Types.ObjectId(viewer.id) },
        ];
      } else {
        filter.hidden = false;
      }
    }

    const { skip, limit } = getPaginationOffset(page, DEFAULT_PAGE_SIZE);
    const [reviews, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean<LeanReview[]>()
        .exec(),
      this.reviewModel.countDocuments(filter).exec(),
    ]);

    const authorIds = [
      ...new Set(reviews.map((review) => review.user.toString())),
    ].map((id) => new Types.ObjectId(id));
    const authors = authorIds.length
      ? await this.userModel
          .find({ _id: { $in: authorIds } })
          .select('name status')
          .lean<ReviewAuthor[]>()
          .exec()
      : [];
    const authorNames = new Map(
      authors.map((author) => [author._id.toString(), author]),
    );

    const items: ReviewResponse[] = reviews.map((review) => {
      const author = authorNames.get(review.user.toString());
      return {
        id: review._id.toString(),
        rating: review.rating,
        text: review.text ?? null,
        author: {
          name:
            !author || author.status === AccountStatus.Deactivated
              ? 'Deleted user'
              : author.name,
        },
        date: review.createdAt!,
        reply: review.reply
          ? { text: review.reply.text, date: review.reply.createdAt }
          : null,
      };
    });

    return {
      averageRating: hotel.averageRating ?? 0,
      ratingCount: hotel.ratingCount ?? 0,
      ...paginate(items, total, page),
    };
  }

  private async findAuthorName(userId: Types.ObjectId): Promise<string> {
    const author = await this.userModel
      .findById(userId)
      .select('name status')
      .lean<ReviewAuthor>()
      .exec();
    return !author || author.status === AccountStatus.Deactivated
      ? 'Deleted user'
      : author.name;
  }

  private toResponse(
    review: ReviewDocument,
    authorName: string,
  ): ReviewResponse {
    return {
      id: review._id.toString(),
      rating: review.rating,
      text: review.text ?? null,
      author: { name: authorName },
      date: review.createdAt!,
      reply: review.reply
        ? { text: review.reply.text, date: review.reply.createdAt }
        : null,
    };
  }
}

function addRatingPipeline(rating: number) {
  const count = { $ifNull: ['$ratingCount', 0] };
  const average = { $ifNull: ['$averageRating', 0] };
  return [
    {
      $set: {
        averageRating: {
          $divide: [
            { $add: [{ $multiply: [average, count] }, rating] },
            { $add: [count, 1] },
          ],
        },
        ratingCount: { $add: [count, 1] },
      },
    },
  ];
}

function changeRatingPipeline(ratingDelta: number) {
  const count = { $max: [{ $ifNull: ['$ratingCount', 0] }, 1] };
  return [
    {
      $set: {
        averageRating: {
          $add: [
            { $ifNull: ['$averageRating', 0] },
            { $divide: [ratingDelta, count] },
          ],
        },
      },
    },
  ];
}

export function removeRatingPipeline(rating: number) {
  const count = { $ifNull: ['$ratingCount', 0] };
  const average = { $ifNull: ['$averageRating', 0] };
  const remainingCount = { $subtract: [count, 1] };
  return [
    {
      $set: {
        averageRating: {
          $cond: [
            { $gt: [count, 1] },
            {
              $divide: [
                { $subtract: [{ $multiply: [average, count] }, rating] },
                remainingCount,
              ],
            },
            0,
          ],
        },
        ratingCount: {
          $cond: [{ $gt: [count, 0] }, remainingCount, 0],
        },
      },
    },
  ];
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}
