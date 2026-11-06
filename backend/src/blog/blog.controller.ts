import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post as HttpPost,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { CurrentUser, Roles } from '../common/decorators';
import { Role } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/interfaces';
import { BlogService } from './blog.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { BrowsePostsByTagDto } from './dto/browse-posts-by-tag.dto';
import { ListMyPostsQueryDto } from './dto/list-my-posts-query.dto';
import type { CreatedPostResponse, MyPostSummary } from './blog.service';
import type { PaginatedList } from '../common/dto/pagination.dto';

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
  constructor(private readonly blogService: BlogService) {}

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
    return this.blogService.createPost(user.id, dto);
  }

  @Patch('posts/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  updatePost(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePostDto,
  ): Promise<CreatedPostResponse> {
    return this.blogService.updatePost(id, user.id, dto);
  }

  @Get('tags/:tag/posts')
  listPostsByTag(
    @Param() params: BrowsePostsByTagDto,
    @Query() query: PaginationQueryDto,
  ) {
    return this.blogService.listPublishedByTag(params.tag, query.page);
  }
}
