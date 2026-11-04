import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreatePostDto } from './dto/create-post.dto';
import { Post, PostDocument } from './schemas/post.schema';
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
}
