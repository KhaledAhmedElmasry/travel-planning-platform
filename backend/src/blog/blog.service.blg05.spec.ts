import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { BlogService } from './blog.service';
import { CommentDocument } from './schemas/comment.schema';
import { PostDocument, PostStatus } from './schemas/post.schema';
import { UserDocument } from '../users/schemas/user.schema';

describe('BlogService BLG-05', () => {
  const postId = new Types.ObjectId();
  const authorId = new Types.ObjectId().toString();
  let service: BlogService;
  let postModel: {
    findOne: jest.Mock;
    updateOne: jest.Mock;
  };
  let commentModel: {
    create: jest.Mock;
    deleteOne: jest.Mock;
  };
  let findOneQuery: {
    select: jest.Mock;
    lean: jest.Mock;
    exec: jest.Mock;
  };
  let updateQuery: { exec: jest.Mock };

  beforeEach(() => {
    findOneQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({ _id: postId }),
    };
    updateQuery = { exec: jest.fn().mockResolvedValue({ matchedCount: 1 }) };
    postModel = {
      findOne: jest.fn().mockReturnValue(findOneQuery),
      updateOne: jest.fn().mockReturnValue(updateQuery),
    };
    commentModel = {
      create: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
      deleteOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      }),
    };

    service = new BlogService(
      postModel as unknown as Model<PostDocument>,
      commentModel as unknown as Model<CommentDocument>,
      {} as Model<UserDocument>,
    );
  });

  it('saves the authenticated author, trims text, sets hidden false, and increments once', async () => {
    const dto = { text: '  helpful comment  ' };

    await service.createComment(postId, authorId, dto);

    expect(postModel.findOne).toHaveBeenCalledWith({
      _id: postId,
      status: PostStatus.Published,
      hidden: false,
    });
    expect(commentModel.create).toHaveBeenCalledWith({
      post: postId,
      author: new Types.ObjectId(authorId),
      text: 'helpful comment',
      hidden: false,
    });
    expect(postModel.updateOne).toHaveBeenCalledWith(
      { _id: postId, status: PostStatus.Published, hidden: false },
      { $inc: { commentCount: 1 } },
    );
    expect(postModel.updateOne).toHaveBeenCalledTimes(1);
  });

  it('returns 404 for a missing, draft, or hidden post without creating a comment', async () => {
    findOneQuery.exec.mockResolvedValue(null);

    await expect(
      service.createComment(postId, authorId, { text: 'hello' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(commentModel.create).not.toHaveBeenCalled();
    expect(postModel.updateOne).not.toHaveBeenCalled();
  });

  it('removes the created comment when the post becomes unavailable before incrementing', async () => {
    updateQuery.exec.mockResolvedValue({ matchedCount: 0 });
    const commentId = new Types.ObjectId();
    commentModel.create.mockResolvedValue({ _id: commentId });
    const cleanupQuery = {
      exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    };
    commentModel.deleteOne.mockReturnValue(cleanupQuery);

    await expect(
      service.createComment(postId, authorId, { text: 'hello' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(commentModel.deleteOne).toHaveBeenCalledWith({ _id: commentId });
  });

  it('removes the created comment and propagates a failed post update', async () => {
    const dbError = new Error('post update failed');
    updateQuery.exec.mockRejectedValue(dbError);
    const commentId = new Types.ObjectId();
    commentModel.create.mockResolvedValue({ _id: commentId });
    commentModel.deleteOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    });

    await expect(
      service.createComment(postId, authorId, { text: 'hello' }),
    ).rejects.toBe(dbError);
    expect(commentModel.deleteOne).toHaveBeenCalledWith({ _id: commentId });
  });

  it('does not increment the post count when comment creation fails', async () => {
    const dbError = new Error('comment insert failed');
    commentModel.create.mockRejectedValue(dbError);

    await expect(
      service.createComment(postId, authorId, { text: 'hello' }),
    ).rejects.toBe(dbError);
    expect(postModel.updateOne).not.toHaveBeenCalled();
  });
});
