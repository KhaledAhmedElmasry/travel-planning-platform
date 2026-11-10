import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type { Request } from 'express';
import { ACCESS_COOKIE } from '../auth/auth-cookies';
import { SessionsService } from '../auth/sessions.service';
import { CurrentUser, Roles } from '../common/decorators';
import { Role } from '../common/enums';
import type { AuthUser } from '../common/interfaces';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import {
  ReviewsService,
  HotelReviewsResponse,
  ReviewResponse,
} from './reviews.service';

// Area: Hotel Booking & Reviews
// Requirements: HTL-23, HTL-24
// Endpoints:
//   POST   /api/hotel-bookings/:id/review   HTL-23
//   PATCH  /api/reviews/:id                 HTL-23
//   DELETE /api/reviews/:id                 HTL-23
//   GET    /api/hotels/:id/reviews          HTL-24
//   POST   /api/reviews/:id/reply           HTL-26 (Optional)
@Controller()
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly sessionsService: SessionsService,
  ) {}

  @Post('hotel-bookings/:id/review')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  createReview(
    @Param('id', ParseObjectIdPipe) reservationId: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewResponse> {
    return this.reviewsService.createReview(reservationId, user.id, dto);
  }

  @Patch('reviews/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  updateReview(
    @Param('id', ParseObjectIdPipe) reviewId: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateReviewDto,
  ): Promise<ReviewResponse> {
    return this.reviewsService.updateReview(reviewId, user.id, dto);
  }

  @Delete('reviews/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  deleteReview(
    @Param('id', ParseObjectIdPipe) reviewId: Types.ObjectId,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.reviewsService.deleteReview(reviewId, user.id);
  }

  @Post('reviews/:id/reply')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HotelModerator)
  replyToReview(
    @Param('id', ParseObjectIdPipe) reviewId: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReplyReviewDto,
  ): Promise<ReviewResponse> {
    return this.reviewsService.replyToReview(reviewId, user, dto);
  }

  @Get('hotels/:id/reviews')
  async listHotelReviews(
    @Param('id', ParseObjectIdPipe) hotelId: Types.ObjectId,
    @Query() query: ListReviewsQueryDto,
    @Req() request: Request,
  ): Promise<HotelReviewsResponse> {
    const cookies: unknown = request.cookies;
    const cookieValue =
      typeof cookies === 'object' &&
      cookies !== null &&
      ACCESS_COOKIE in cookies
        ? (cookies as Record<string, unknown>)[ACCESS_COOKIE]
        : undefined;
    let viewer: AuthUser | undefined;
    if (typeof cookieValue === 'string') {
      try {
        viewer = await this.sessionsService.authenticate(cookieValue);
      } catch (error) {
        if (
          !(error instanceof UnauthorizedException) &&
          !(error instanceof ForbiddenException)
        ) {
          throw error;
        }
      }
    }

    return this.reviewsService.listHotelReviews(hotelId, query.page, viewer);
  }
}
