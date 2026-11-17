import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, PipelineStage, Types } from 'mongoose';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Comment, CommentDocument } from './schemas/comment.schema';
import { Like, LikeDocument } from './schemas/like.schema';
import {
  DEFAULT_PAGE_SIZE,
  getPaginationOffset,
  PaginatedList,
  paginate,
} from '../common/dto/pagination.dto';
import { AccountStatus, Role } from '../common/enums';
import type { AuthUser } from '../common/interfaces';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Post, PostDocument, PostStatus } from './schemas/post.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UploadsService } from '../uploads/uploads.service';
import {
  PostDeletionCleanup,
  PostDeletionCleanupDocument,
} from './schemas/post-deletion-cleanup.schema';
import { UsersService } from '../users/users.service';
import {
  ItinerariesService,
  ItinerarySummary,
} from '../itineraries/itineraries.service';

const MAX_POST_IMAGES = 5;
const POST_IMAGE_LIMIT_MESSAGE =
  'Not JPG/PNG, larger than 5 MB, or the post already has 5 images.';

export interface MyPostSummary {
  id: string;
  title: string;
  status: PostStatus;
  date: Date;
  likeCount: number;
  commentCount: number;
}

export interface CreatedPostResponse {
  id: string;
  title: string;
  body: string;
  author: { id: string; name: string };
  status: Post['status'];
  tags: string[];
  hidden: boolean;
  likeCount: number;
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostSummary {
  id: string;
  title: string;
  author: { id: string; name: string };
  date: Date;
  excerpt: string;
  tags: string[];
  likeCount: number;
  commentCount: number;
}

export interface LikeCountResponse {
  likeCount: number;
}

export interface AttachItineraryResponse {
  id: string;
  itineraryId: string | null;
}

export interface CommentResponse {
  id: string;
  author: { id: string; name: string };
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostDetailComment {
  id: string;
  author: { id: string; name: string };
  text: string;
  date: Date;
}

export interface PostDetailResponse {
  id: string;
  title: string;
  body: string;
  author: { id: string; name: string };
  date: Date;
  tags: string[];
  images: { id: string; url: string }[];
  likeCount: number;
  likedByMe?: boolean;
  status: PostStatus;
  comments: PostDetailComment[];
  commentCount: number;
}

export interface PublicAuthorPageResponse {
  author: { id: string; name: string; createdAt: Date };
  posts: PaginatedList<PostSummary>;
  itineraries: PaginatedList<ItinerarySummary>;
}

interface PostListAggregation {
  items: PostSummary[];
  metadata: { total: number }[];
}

// Area: Community & Cross-cutting
// Business logic and database access for: BLG-01..BLG-12
@Injectable()
export class BlogService {
  private readonly logger = new Logger(BlogService.name);

  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
    @InjectModel(Like.name) private readonly likeModel: Model<LikeDocument>,
    @InjectModel(PostDeletionCleanup.name)
    private readonly postDeletionCleanupModel: Model<PostDeletionCleanupDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly uploadsService: UploadsService,
    private readonly usersService: UsersService,
    private readonly itinerariesService: ItinerariesService,
  ) {}

  async getPostDetail(
    postId: Types.ObjectId,
    commentsPage = 1,
    viewer?: AuthUser,
  ): Promise<PostDetailResponse> {
    const post = await this.postModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException(
        'Post not found, or a draft or hidden post of another user.',
      );
    }

    const author = await this.usersService.findById(post.author.toString());
    if (!author || author.status === AccountStatus.Deactivated) {
      throw new NotFoundException('Post not found.');
    }

    const isOwner = viewer?.id === post.author.toString();
    const isAdmin = viewer?.role === Role.Admin;
    if (
      (post.status !== PostStatus.Published || post.hidden) &&
      !isOwner &&
      !isAdmin
    ) {
      throw new NotFoundException(
        'Post not found, or a draft or hidden post of another user.',
      );
    }

    const commentFilter: Record<string, unknown> = { post: postId };
    if (viewer?.role !== Role.Admin) {
      if (viewer) {
        commentFilter.$or = [
          { hidden: false },
          { hidden: true, author: new Types.ObjectId(viewer.id) },
        ];
      } else {
        commentFilter.hidden = false;
      }
    }
    const { skip, limit } = getPaginationOffset(
      commentsPage,
      DEFAULT_PAGE_SIZE,
    );
    const [comments, commentCount, liked] = await Promise.all([
      this.commentModel
        .find(commentFilter)
        .sort({ createdAt: 1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.commentModel.countDocuments(commentFilter).exec(),
      viewer
        ? this.likeModel
            .exists({ post: postId, user: new Types.ObjectId(viewer.id) })
            .exec()
        : Promise.resolve(null),
    ]);

    const commentResponses = await Promise.all(
      comments.map(async (comment): Promise<PostDetailComment> => {
        const commentAuthor = await this.usersService.findById(
          comment.author.toString(),
        );
        return {
          id: comment._id.toString(),
          author: {
            id: comment.author.toString(),
            name:
              !commentAuthor ||
              commentAuthor.status === AccountStatus.Deactivated
                ? 'Deleted user'
                : commentAuthor.name,
          },
          text: comment.text,
          date: comment.createdAt!,
        };
      }),
    );

    const response: PostDetailResponse = {
      id: post._id.toString(),
      title: post.title,
      body: post.body,
      author: { id: author._id.toString(), name: author.name },
      date: post.createdAt!,
      tags: post.tags,
      images: (post.images ?? []).map(({ id, url }) => ({ id, url })),
      likeCount: post.likeCount,
      status: post.status,
      comments: commentResponses,
      commentCount,
    };
    if (viewer) response.likedByMe = Boolean(liked);
    return response;
  }

  async getPublicAuthorPage(
    authorId: Types.ObjectId,
    postsPage = 1,
    itinerariesPage = 1,
  ): Promise<PublicAuthorPageResponse> {
    const author = await this.usersService.findById(authorId.toString());
    if (!author || author.status === AccountStatus.Deactivated) {
      throw new NotFoundException('Author not found or deactivated.');
    }

    const filter = {
      author: authorId,
      status: PostStatus.Published,
      hidden: false,
    };
    const { skip, limit } = getPaginationOffset(postsPage, DEFAULT_PAGE_SIZE);
    const [posts, total, itineraries] = await Promise.all([
      this.postModel
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.postModel.countDocuments(filter).exec(),
      this.itinerariesService.listPublicByAuthor(authorId, itinerariesPage),
    ]);

    const postItems: PostSummary[] = posts.map((post) => ({
      id: post._id.toString(),
      title: post.title,
      author: { id: author._id.toString(), name: author.name },
      date: post.createdAt!,
      excerpt: post.body.slice(0, 200),
      tags: post.tags,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
    }));

    return {
      author: {
        id: author._id.toString(),
        name: author.name,
        createdAt: author.createdAt!,
      },
      posts: paginate(postItems, total, postsPage),
      itineraries,
    };
  }

  async listPublished(
    query: ListPostsQueryDto,
  ): Promise<PaginatedList<PostSummary>> {
    const page = query.page ?? 1;
    const { skip, limit } = getPaginationOffset(page, DEFAULT_PAGE_SIZE);
    const match: Record<string, unknown> = {
      status: PostStatus.Published,
      hidden: false,
    };

    if (query.tag) {
      const tag = this.escapeRegex(query.tag);
      match.tags = { $regex: `^${tag}$`, $options: 'i' };
    }

    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $lookup: {
          from: this.userModel.collection.name,
          localField: 'author',
          foreignField: '_id',
          as: 'authorRecord',
        },
      },
      { $unwind: '$authorRecord' },
      {
        $match: {
          'authorRecord.status': { $ne: AccountStatus.Deactivated },
        },
      },
    ];

    if (query.keyword) {
      const keyword = this.escapeRegex(query.keyword);
      pipeline.push({
        $match: {
          $or: [
            { title: { $regex: keyword, $options: 'i' } },
            { tags: { $regex: keyword, $options: 'i' } },
            { 'authorRecord.name': { $regex: keyword, $options: 'i' } },
          ],
        },
      });
      pipeline.push({
        $addFields: {
          interactionScore: {
            $add: [
              { $ifNull: ['$likeCount', 0] },
              { $ifNull: ['$commentCount', 0] },
            ],
          },
        },
      });
    }

    pipeline.push({
      $facet: {
        items: [
          {
            $sort: query.keyword
              ? { interactionScore: -1, createdAt: -1, _id: -1 }
              : { createdAt: -1, _id: -1 },
          },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              id: { $toString: '$_id' },
              title: 1,
              author: {
                id: { $toString: '$author' },
                name: '$authorRecord.name',
              },
              date: '$createdAt',
              excerpt: { $substrCP: ['$body', 0, 200] },
              tags: 1,
              likeCount: 1,
              commentCount: 1,
            },
          },
        ],
        metadata: [{ $count: 'total' }],
      },
    });

    const [result] = await this.postModel
      .aggregate<PostListAggregation>(pipeline)
      .exec();
    return paginate(result?.items ?? [], result?.metadata[0]?.total ?? 0, page);
  }

  // BLG-10 + GEN-08: attach an image to the author's own post. The shared upload
  // rule (JPG/PNG, 5 MB, real image bytes) is checked by UploadsService; at most
  // 5 images per post is enforced atomically in the update itself (the filter
  // requires that there is no 5th image yet), so simultaneous uploads can never
  // pass the limit. If the post disappeared or filled up meanwhile, the stored
  // file is removed again.
  async attachPostImage(
    postId: Types.ObjectId,
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ id: string; url: string }> {
    const authorObjectId = new Types.ObjectId(userId);
    const post = await this.postModel
      .findById(postId)
      .select('author images.id')
      .lean<{ author: Types.ObjectId; images?: { id: string }[] }>()
      .exec();
    if (!post) throw new NotFoundException('Post not found.');
    if (post.author.toString() !== userId) {
      throw new ForbiddenException('Not the author of this post.');
    }
    if ((post.images ?? []).length >= MAX_POST_IMAGES) {
      throw new BadRequestException(POST_IMAGE_LIMIT_MESSAGE);
    }

    const image = await this.uploadsService.storeImage(file);
    let updated: { _id: Types.ObjectId } | null;
    try {
      updated = await this.postModel
        .findOneAndUpdate(
          {
            _id: postId,
            author: authorObjectId,
            [`images.${MAX_POST_IMAGES - 1}`]: { $exists: false },
          },
          {
            $push: {
              images: {
                id: image.id,
                url: image.url,
                storageKey: image.storageKey,
              },
            },
          },
        )
        .select('_id')
        .lean<{ _id: Types.ObjectId }>()
        .exec();
    } catch (error) {
      await this.uploadsService.removeImage(image.storageKey);
      throw error;
    }
    if (!updated) {
      await this.uploadsService.removeImage(image.storageKey);
      const stillThere = await this.postModel.exists({
        _id: postId,
        author: authorObjectId,
      });
      if (!stillThere) throw new NotFoundException('Post not found.');
      throw new BadRequestException(POST_IMAGE_LIMIT_MESSAGE);
    }
    return { id: image.id, url: image.url };
  }

  // BLG-10: remove an image from the author's own post (the file is deleted too).
  async removePostImage(
    postId: Types.ObjectId,
    imageId: string,
    userId: string,
  ): Promise<void> {
    const post = await this.postModel
      .findById(postId)
      .select('author images.id +images.storageKey')
      .lean<{
        author: Types.ObjectId;
        images?: { id: string; storageKey: string }[];
      }>()
      .exec();
    if (!post) throw new NotFoundException('Post or image not found.');
    if (post.author.toString() !== userId) {
      throw new ForbiddenException('Not the author of this post.');
    }
    const image = (post.images ?? []).find((item) => item.id === imageId);
    if (!image) throw new NotFoundException('Post or image not found.');

    // Only the request that really pulls the image deletes the file.
    const result = await this.postModel
      .updateOne(
        { _id: postId, author: post.author, 'images.id': imageId },
        { $pull: { images: { id: imageId } } },
      )
      .exec();
    if (result.modifiedCount !== 1) {
      throw new NotFoundException('Post or image not found.');
    }
    await this.uploadsService.removeImage(image.storageKey);
  }

  async deletePost(postId: Types.ObjectId, authorId: string): Promise<void> {
    const authorObjectId = new Types.ObjectId(authorId);
    const pendingCleanup = await this.postDeletionCleanupModel
      .findOne({ postId, author: authorObjectId })
      .lean()
      .exec();

    if (pendingCleanup) {
      await this.finishPostImageCleanup(
        postId,
        authorObjectId,
        pendingCleanup.storageKeys,
      );
      return;
    }

    const storageKeys: string[] = [];
    await this.connection.transaction(async (session) => {
      const post = await this.postModel
        .findById(postId)
        .select('+images.storageKey')
        .session(session)
        .exec();
      if (!post) throw new NotFoundException('Post not found.');
      if (post.author.toString() !== authorId) {
        throw new ForbiddenException('Not the author of this post.');
      }

      storageKeys.push(...(post.images ?? []).map((image) => image.storageKey));
      if (storageKeys.length > 0) {
        await this.postDeletionCleanupModel.create(
          [{ postId, author: authorObjectId, storageKeys }],
          { session },
        );
      }
      await this.commentModel.deleteMany({ post: postId }, { session }).exec();
      await this.likeModel.deleteMany({ post: postId }, { session }).exec();
      const result = await this.postModel
        .deleteOne({ _id: postId, author: authorObjectId }, { session })
        .exec();
      if (result.deletedCount !== 1) {
        throw new NotFoundException('Post not found.');
      }
    });

    if (storageKeys.length > 0)
      await this.finishPostImageCleanup(postId, authorObjectId, storageKeys);
  }

  private async finishPostImageCleanup(
    postId: Types.ObjectId,
    authorId: Types.ObjectId,
    storageKeys: string[],
  ): Promise<void> {
    try {
      // removeImages treats already-missing files as success, so retrying a partially
      // completed cleanup is safe. The durable record is cleared only after all keys
      // have been removed.
      await this.uploadsService.removeImages(storageKeys);
      await this.postDeletionCleanupModel
        .deleteOne({ postId, author: authorId })
        .exec();
    } catch (error) {
      this.logger.error(
        `Post ${postId.toString()} image cleanup remains pending.`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        'Post is deleted; image cleanup remains pending. Retry the delete request.',
      );
    }
  }

  async likePost(
    postId: Types.ObjectId,
    userId: string,
  ): Promise<LikeCountResponse> {
    try {
      return await this.connection.transaction(async (session) => {
        const post = await this.postModel
          .findOneAndUpdate(
            {
              _id: postId,
              status: PostStatus.Published,
              hidden: false,
            },
            { $inc: { likeCount: 1 } },
            { new: true, session },
          )
          .select('likeCount')
          .exec();
        if (!post) {
          throw new NotFoundException('Post not found or not published.');
        }

        await this.likeModel.create(
          [{ post: postId, user: new Types.ObjectId(userId) }],
          { session },
        );
        return { likeCount: post.likeCount };
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('The user already likes this post.');
      }
      throw error;
    }
  }

  async unlikePost(
    postId: Types.ObjectId,
    userId: string,
  ): Promise<LikeCountResponse> {
    return this.connection.transaction(async (session) => {
      const postExists = await this.postModel
        .exists({ _id: postId })
        .session(session)
        .exec();
      if (!postExists) {
        throw new NotFoundException(
          'Post not found, or the user has not liked it.',
        );
      }

      const like = await this.likeModel
        .findOneAndDelete({ post: postId, user: new Types.ObjectId(userId) })
        .session(session)
        .exec();
      if (!like) {
        throw new NotFoundException(
          'Post not found, or the user has not liked it.',
        );
      }

      const post = await this.postModel
        .findOneAndUpdate(
          { _id: postId, likeCount: { $gt: 0 } },
          { $inc: { likeCount: -1 } },
          { new: true, session },
        )
        .select('likeCount')
        .exec();
      if (!post) {
        throw new InternalServerErrorException(
          'Like count is inconsistent with the stored likes.',
        );
      }
      return { likeCount: post.likeCount };
    });
  }

  async updateComment(
    commentId: Types.ObjectId,
    authorId: string,
    dto: UpdateCommentDto,
  ): Promise<CommentResponse> {
    const existing = await this.commentModel.findById(commentId).exec();
    if (!existing) throw new NotFoundException('Comment not found.');
    if (existing.author.toString() !== authorId) {
      throw new ForbiddenException('Not the author of this comment.');
    }

    const comment = await this.commentModel
      .findOneAndUpdate(
        { _id: commentId, author: new Types.ObjectId(authorId) },
        { $set: { text: dto.text.trim() } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!comment) throw new NotFoundException('Comment not found.');
    return this.toCommentResponse(comment);
  }

  async deleteComment(
    commentId: Types.ObjectId,
    authorId: string,
  ): Promise<void> {
    await this.connection.transaction(async (session) => {
      const existing = await this.commentModel
        .findById(commentId)
        .session(session)
        .exec();
      if (!existing) throw new NotFoundException('Comment not found.');
      if (existing.author.toString() !== authorId) {
        throw new ForbiddenException('Not the author of this comment.');
      }

      const comment = await this.commentModel
        .findOneAndDelete({
          _id: commentId,
          author: new Types.ObjectId(authorId),
        })
        .session(session)
        .exec();
      if (!comment) throw new NotFoundException('Comment not found.');
      // A comment hidden by an admin was already taken off the count (GEN-10).
      if (comment.hidden) return;

      const post = await this.postModel
        .findOneAndUpdate(
          { _id: comment.post, commentCount: { $gt: 0 } },
          { $inc: { commentCount: -1 } },
          { new: true, session },
        )
        .select('_id')
        .exec();
      if (post) return;

      const parentExists = await this.postModel
        .exists({ _id: comment.post })
        .session(session)
        .exec();
      if (parentExists) {
        throw new InternalServerErrorException(
          'Comment count is inconsistent with the stored comments.',
        );
      }
      // An orphaned comment can be removed; there is no parent counter to adjust.
    });
  }

  async createComment(
    postId: Types.ObjectId,
    authorId: string,
    dto: CreateCommentDto,
  ): Promise<void> {
    await this.connection.transaction(async (session) => {
      // Incrementing the visible post inside this transaction serializes creation
      // with post deletion. The comment and counter commit or roll back together.
      const post = await this.postModel
        .findOneAndUpdate(
          {
            _id: postId,
            status: PostStatus.Published,
            hidden: false,
          },
          { $inc: { commentCount: 1 } },
          { session },
        )
        .select('_id')
        .exec();

      if (!post) {
        throw new NotFoundException('Post not found or not published.');
      }

      await this.commentModel.create(
        [
          {
            post: postId,
            author: new Types.ObjectId(authorId),
            text: dto.text.trim(),
            hidden: false,
          },
        ],
        { session },
      );
    });
  }

  async listMine(
    authorId: string,
    page = 1,
    status?: PostStatus,
  ): Promise<PaginatedList<MyPostSummary>> {
    const filter: { author: Types.ObjectId; status?: PostStatus } = {
      author: new Types.ObjectId(authorId),
    };
    if (status !== undefined) filter.status = status;

    const { skip, limit } = getPaginationOffset(page, DEFAULT_PAGE_SIZE);
    const [posts, total] = await Promise.all([
      this.postModel
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.postModel.countDocuments(filter).exec(),
    ]);

    const items: MyPostSummary[] = posts.map((post) => ({
      id: post._id.toString(),
      title: post.title,
      status: post.status,
      date: post.createdAt!,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
    }));

    return paginate(items, total, page);
  }

  async createPost(
    authorId: string,
    dto: CreatePostDto,
  ): Promise<CreatedPostResponse> {
    const author = await this.userModel
      .findById(authorId)
      .select('name')
      .lean<{ _id: Types.ObjectId; name: string }>()
      .exec();

    if (!author) throw new NotFoundException('Author not found');

    const post = await this.postModel.create({
      author: new Types.ObjectId(authorId),
      title: dto.title,
      body: dto.body,
      status: dto.status,
      tags: dto.tags ?? [],
      hidden: false,
      likeCount: 0,
      commentCount: 0,
    });

    return {
      id: post._id.toString(),
      title: post.title,
      body: post.body,
      author: { id: author._id.toString(), name: author.name },
      status: post.status,
      tags: post.tags,
      hidden: post.hidden,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      createdAt: post.createdAt!,
      updatedAt: post.updatedAt!,
    };
  }

  async updatePost(
    postId: string | Types.ObjectId,
    authorId: string,
    dto: UpdatePostDto,
  ): Promise<CreatedPostResponse> {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException(
        'At least one post field must be provided.',
      );
    }

    const post = await this.postModel.findById(postId).exec();
    if (!post) throw new NotFoundException('Post not found.');
    if (post.author.toString() !== authorId) {
      throw new ForbiddenException('Not the author of this post.');
    }

    // All fields in the shared UpdatePostRequest are handled here. BLG-08 uses the tags
    // field, while title/body/status remain compatible with the shared BLG-04 route contract.
    // One atomic update: edits sent at the same moment never conflict (a load-and-save of the
    // tags array fails with a version error when two requests overlap).
    const changes: Partial<Pick<Post, 'title' | 'body' | 'status' | 'tags'>> =
      {};
    if (dto.title !== undefined) changes.title = dto.title;
    if (dto.body !== undefined) changes.body = dto.body;
    if (dto.status !== undefined) changes.status = dto.status;
    if (dto.tags !== undefined) changes.tags = dto.tags;
    const updated = await this.postModel
      .findOneAndUpdate(
        { _id: post._id, author: post.author },
        { $set: changes },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updated) throw new NotFoundException('Post not found.');

    const author = await this.userModel
      .findById(post.author)
      .select('name')
      .lean<{ _id: Types.ObjectId; name: string }>()
      .exec();
    if (!author) throw new NotFoundException('Author not found.');

    return this.toCreatedPostResponse(updated, author);
  }

  async attachItinerary(
    postId: string | Types.ObjectId,
    authorId: string,
    itineraryId: string | null,
  ): Promise<AttachItineraryResponse> {
    const post = await this.postModel.findById(postId).exec();
    if (!post) throw new NotFoundException('Post not found.');
    if (post.author.toString() !== authorId) {
      throw new ForbiddenException('Not the author of this post.');
    }

    if (itineraryId === null) {
      post.itinerary = null;
    } else {
      // Reuse ITN-03 ownership and not-found behavior; public visibility is not required here.
      await this.itinerariesService.getOne(itineraryId, authorId);
      post.itinerary = new Types.ObjectId(itineraryId);
    }

    await post.save();
    return {
      id: post._id.toString(),
      itineraryId: post.itinerary?.toString() ?? null,
    };
  }

  async listPublishedByTag(
    tag: string,
    page = 1,
  ): Promise<PaginatedList<PostSummary>> {
    const normalizedTag = tag.trim();
    if (!normalizedTag || normalizedTag.length > 30) {
      throw new BadRequestException('Tag must be between 1 and 30 characters.');
    }

    const escapedTag = normalizedTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const deactivatedAuthors = await this.userModel
      .distinct('_id', { status: AccountStatus.Deactivated })
      .exec();
    const filter = {
      status: PostStatus.Published,
      hidden: false,
      author: { $nin: deactivatedAuthors },
      tags: { $regex: `^${escapedTag}$`, $options: 'i' },
    };
    const { skip, limit } = getPaginationOffset(page, DEFAULT_PAGE_SIZE);
    const [posts, total] = await Promise.all([
      this.postModel
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.postModel.countDocuments(filter).exec(),
    ]);

    if (posts.length === 0) return paginate([], total, page);

    const authorIds = posts.map((post) => post.author);
    const authors = await this.userModel
      .find({ _id: { $in: authorIds } })
      .select('name')
      .lean<{ _id: Types.ObjectId; name: string }[]>()
      .exec();
    const authorById = new Map(
      authors.map((author) => [author._id.toString(), author]),
    );

    const items: PostSummary[] = posts.flatMap((post) => {
      const author = authorById.get(post.author.toString());
      // The visibility filter excludes deactivated authors; this guard also handles a
      // concurrent account deletion between the post and author queries.
      if (!author) return [];
      return [
        {
          id: post._id.toString(),
          title: post.title,
          author: { id: author._id.toString(), name: author.name },
          date: post.createdAt!,
          excerpt: post.body.slice(0, 200),
          tags: post.tags,
          likeCount: post.likeCount,
          commentCount: post.commentCount,
        },
      ];
    });

    return paginate(items, total, page);
  }

  private async toCommentResponse(
    comment: CommentDocument,
  ): Promise<CommentResponse> {
    const author = await this.userModel
      .findById(comment.author)
      .select('name')
      .lean<{ _id: Types.ObjectId; name: string }>()
      .exec();

    return {
      id: comment._id.toString(),
      author: {
        id: comment.author.toString(),
        name: author?.name ?? 'Deleted user',
      },
      text: comment.text,
      createdAt: comment.createdAt!,
      updatedAt: comment.updatedAt!,
    };
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 11000
    );
  }

  private toCreatedPostResponse(
    post: PostDocument,
    author: { _id: Types.ObjectId; name: string },
  ): CreatedPostResponse {
    return {
      id: post._id.toString(),
      title: post.title,
      body: post.body,
      author: { id: author._id.toString(), name: author.name },
      status: post.status,
      tags: post.tags,
      hidden: post.hidden,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      createdAt: post.createdAt!,
      updatedAt: post.updatedAt!,
    };
  }
}
