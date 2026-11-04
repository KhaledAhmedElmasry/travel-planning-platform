import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  DEFAULT_PAGE_SIZE,
  getPaginationOffset,
  PaginatedList,
  paginate,
} from '../common/dto/pagination.dto';
import { AccountStatus } from '../common/enums';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Post, PostDocument, PostStatus } from './schemas/post.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

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

// Area: Community & Cross-cutting
// Business logic and database access for: BLG-01..BLG-12
@Injectable()
export class BlogService {
  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

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
    if (dto.title !== undefined) post.title = dto.title;
    if (dto.body !== undefined) post.body = dto.body;
    if (dto.status !== undefined) post.status = dto.status;
    if (dto.tags !== undefined) post.tags = dto.tags;
    await post.save();

    const author = await this.userModel
      .findById(post.author)
      .select('name')
      .lean<{ _id: Types.ObjectId; name: string }>()
      .exec();
    if (!author) throw new NotFoundException('Author not found.');

    return this.toCreatedPostResponse(post, author);
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
