import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post as HttpPost,
  Query,
  Req,
  UnauthorizedException,
  ForbiddenException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { CurrentUser, Roles } from '../common/decorators';
import { Role } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/interfaces';
import type { Request } from 'express';
import { ACCESS_COOKIE } from '../auth/auth-cookies';
import { SessionsService } from '../auth/sessions.service';
import { RevalidationService } from '../revalidation/revalidation.service';
import { BlogService } from './blog.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { AttachItineraryDto } from './dto/attach-itinerary.dto';
import { BrowsePostsByTagDto } from './dto/browse-posts-by-tag.dto';
import { ListMyPostsQueryDto } from './dto/list-my-posts-query.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import type {
  CommentResponse,
  CreatedPostResponse,
  AttachItineraryResponse,
  LikeCountResponse,
  MyPostSummary,
  PostSummary,
} from './blog.service';
import type { PaginatedList } from '../common/dto/pagination.dto';
import {
  PostDetailQueryDto,
  PublicAuthorPageQueryDto,
} from './dto/public-pages-query.dto';

// Area: Community & Cross-cutting
// Requirements: BLG-01..BLG-12
// Endpoints to implement (PDF section 8):
//   POST   /api/posts                         BLG-01
//   GET    /api/posts                         BLG-02, BLG-09
//   GET    /api/posts/:id                     BLG-02
//   GET    /api/posts/mine                    BLG-03
//   PATCH  /api/posts/:id                     BLG-04, BLG-08
//   DELETE /api/posts/:id                     BLG-04
//   POST   /api/posts/:id/comments            BLG-05
//   PATCH  /api/comments/:id                  BLG-07
//   DELETE /api/comments/:id                  BLG-07
//   POST   /api/posts/:id/like                BLG-06
//   DELETE /api/posts/:id/like                BLG-06
//   POST   /api/posts/:id/images              BLG-10, GEN-08
//   DELETE /api/posts/:id/images/:imageId     BLG-10
//   GET    /api/tags/:tag/posts               BLG-08
//   GET    /api/authors/:id                   BLG-12
// Notes:
//   Declare /posts/mine before /posts/:id so "mine" is not matched as an id.
//   Hidden content (GEN-10) and content of deactivated authors (ACC-12) is not shown publicly.
// BONUS (optional): implement only after all mandatory requirements are done (PDF section 12).
// Bonus endpoints:
//   PATCH /api/posts/:id/itinerary   BLG-13 (Optional)
@Controller()
export class BlogController {
  constructor(
    private readonly blogService: BlogService,
    private readonly sessionsService: SessionsService,
    private readonly revalidation: RevalidationService,
  ) {}

  // B5: after the author changed a post, refresh its cached page and the author page (ISR).
  private async refresh<T>(
    change: Promise<T>,
    postId: (result: T) => Types.ObjectId | string,
    authorId: string,
  ): Promise<T> {
    const result = await change;
    this.revalidation.post(postId(result), authorId);
    return result;
  }

  @HttpPost('posts/:id/comments')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  createComment(
    @Param('id', ParseObjectIdPipe) postId: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCommentDto,
  ): Promise<void> {
    return this.blogService.createComment(postId, user.id, dto);
  }

  // Declare /posts/mine before a future /posts/:id route (BLG-02).
  @Get('posts/mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  listMyPosts(
    @CurrentUser() user: AuthUser,
    @Query() query: ListMyPostsQueryDto,
  ): Promise<PaginatedList<MyPostSummary>> {
    return this.blogService.listMine(user.id, query.page, query.status);
  }

  @HttpPost('posts')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  createPost(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePostDto,
  ): Promise<CreatedPostResponse> {
    return this.refresh(
      this.blogService.createPost(user.id, dto),
      (created) => created.id,
      user.id,
    );
  }

  @Get('posts')
  listPosts(
    @Query() query: ListPostsQueryDto,
  ): Promise<PaginatedList<PostSummary>> {
    return this.blogService.listPublished(query);
  }

  @Get('posts/:id')
  async getPost(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Query() query: PostDetailQueryDto,
    @Req() request: Request,
  ) {
    const cookies: unknown = request.cookies;
    const cookieValue =
      typeof cookies === 'object' &&
      cookies !== null &&
      ACCESS_COOKIE in cookies
        ? (cookies as Record<string, unknown>)[ACCESS_COOKIE]
        : undefined;
    const token = typeof cookieValue === 'string' ? cookieValue : undefined;
    let viewer: AuthUser | undefined;
    if (token) {
      try {
        viewer = await this.sessionsService.authenticate(token);
      } catch (error) {
        // This endpoint remains public if the optional cookie is absent, expired, or belongs to
        // an account that cannot authenticate. Unexpected database/runtime errors still surface.
        if (
          !(error instanceof UnauthorizedException) &&
          !(error instanceof ForbiddenException)
        ) {
          throw error;
        }
      }
    }
    return this.blogService.getPostDetail(id, query.commentsPage, viewer);
  }

  @Get('authors/:id')
  getAuthorPage(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Query() query: PublicAuthorPageQueryDto,
  ) {
    return this.blogService.getPublicAuthorPage(
      id,
      query.postsPage,
      query.itinerariesPage,
    );
  }

  @Patch('posts/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  updatePost(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePostDto,
  ): Promise<CreatedPostResponse> {
    return this.refresh(
      this.blogService.updatePost(id, user.id, dto),
      () => id,
      user.id,
    );
  }

  @Patch('posts/:id/itinerary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  attachItinerary(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @Body() dto: AttachItineraryDto,
  ): Promise<AttachItineraryResponse> {
    return this.refresh(
      this.blogService.attachItinerary(id, user.id, dto.itineraryId),
      () => id,
      user.id,
    );
  }

  @Delete('posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  deletePost(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.refresh(
      this.blogService.deletePost(id, user.id),
      () => id,
      user.id,
    );
  }

  @HttpPost('posts/:id/images')
  @UseInterceptors(FileInterceptor('image'))
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  attachPostImage(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ id: string; url: string }> {
    if (!file) throw new BadRequestException('image is required');
    return this.refresh(
      this.blogService.attachPostImage(id, user.id, file),
      () => id,
      user.id,
    );
  }

  @Delete('posts/:id/images/:imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  removePostImage(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Param('imageId', ParseObjectIdPipe) imageId: Types.ObjectId,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.refresh(
      this.blogService.removePostImage(id, imageId.toHexString(), user.id),
      () => id,
      user.id,
    );
  }

  @HttpPost('posts/:id/like')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  likePost(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
  ): Promise<LikeCountResponse> {
    return this.blogService.likePost(id, user.id);
  }

  @Delete('posts/:id/like')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  unlikePost(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
  ): Promise<LikeCountResponse> {
    return this.blogService.unlikePost(id, user.id);
  }

  @Patch('comments/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  updateComment(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCommentDto,
  ): Promise<CommentResponse> {
    return this.blogService.updateComment(id, user.id, dto);
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  deleteComment(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.blogService.deleteComment(id, user.id);
  }

  @Get('tags/:tag/posts')
  listPostsByTag(
    @Param() params: BrowsePostsByTagDto,
    @Query() query: PaginationQueryDto,
  ) {
    return this.blogService.listPublishedByTag(params.tag, query.page);
  }
}
