import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  DEFAULT_PAGE_SIZE,
  getPaginationOffset,
  PaginatedList,
  paginate,
} from '../common/dto/pagination.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { Post, PostDocument, PostStatus } from './schemas/post.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

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

// Area: Community & Cross-cutting
// Business logic and database access for: BLG-01..BLG-12
@Injectable()
export class BlogService {
  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

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
}
