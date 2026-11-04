import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { Comment, CommentDocument } from './schemas/comment.schema';
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

// Area: Community & Cross-cutting
// Business logic and database access for: BLG-01..BLG-12
@Injectable()
export class BlogService {
  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async createComment(
    postId: Types.ObjectId,
    authorId: string,
    dto: CreateCommentDto,
  ): Promise<void> {
    const post = await this.postModel
      .findOne({
        _id: postId,
        status: PostStatus.Published,
        hidden: false,
      })
      .select('_id')
      .lean<{ _id: Types.ObjectId }>()
      .exec();

    if (!post) {
      throw new NotFoundException('Post not found or not published.');
    }

    const comment = await this.commentModel.create({
      post: postId,
      author: new Types.ObjectId(authorId),
      text: dto.text.trim(),
      hidden: false,
    });

    let updateResult;
    try {
      // Recheck visibility atomically to avoid incrementing if the post was hidden,
      // unpublished, or deleted after the initial read.
      updateResult = await this.postModel
        .updateOne(
          { _id: postId, status: PostStatus.Published, hidden: false },
          { $inc: { commentCount: 1 } },
        )
        .exec();
    } catch (error) {
      await this.removeCommentAfterFailedPostUpdate(comment._id);
      throw error;
    }

    if (updateResult.matchedCount === 0) {
      const notFound = new NotFoundException(
        'Post not found or not published.',
      );
      await this.removeCommentAfterFailedPostUpdate(comment._id);
      throw notFound;
    }
  }

  private async removeCommentAfterFailedPostUpdate(
    commentId: Types.ObjectId,
  ): Promise<void> {
    try {
      await this.commentModel.deleteOne({ _id: commentId }).exec();
    } catch {
      // Preserve the original failure. Cleanup is best-effort when MongoDB itself
      // is unavailable.
    }
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
