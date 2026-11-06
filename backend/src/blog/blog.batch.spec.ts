/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { BlogService } from './blog.service';
import { LikeSchema } from './schemas/like.schema';
import { PostStatus } from './schemas/post.schema';

const id = () => new Types.ObjectId();
const query = <T>(value: T) => ({
  select: jest.fn().mockReturnThis(),
  session: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(value),
});

describe('BlogService BLG-04/06/07/09', () => {
  let service: BlogService;
  let posts: Record<string, jest.Mock>;
  let comments: Record<string, jest.Mock>;
  let likes: Record<string, jest.Mock>;
  let cleanupRecords: Record<string, jest.Mock>;
  let users: Record<string, jest.Mock>;
  let transaction: jest.Mock;
  let uploads: { removeImages: jest.Mock };

  beforeEach(() => {
    posts = {
      findById: jest.fn(),
      findOneAndUpdate: jest.fn(),
      exists: jest.fn(),
      deleteOne: jest.fn(),
      aggregate: jest.fn(),
    };
    comments = {
      create: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn(),
      findById: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn(),
    };
    likes = {
      deleteMany: jest.fn(),
      create: jest.fn(),
      findOneAndDelete: jest.fn(),
    };
    cleanupRecords = {
      findOne: jest.fn().mockReturnValue(query(null)),
      create: jest.fn().mockResolvedValue([]),
      deleteOne: jest.fn().mockReturnValue(query({ deletedCount: 1 })),
    };
    users = { findById: jest.fn() };
    transaction = jest.fn((callback: (session: object) => unknown) =>
      Promise.resolve(callback({ transaction: true })),
    );
    uploads = { removeImages: jest.fn().mockResolvedValue(undefined) };
    service = new BlogService(
      posts as never,
      comments as never,
      likes as never,
      cleanupRecords as never,
      users as never,
      { transaction } as never,
      uploads as never,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('updates only supplied post fields and preserves tags-only updates', async () => {
    const authorId = id().toString();
    const post = {
      _id: id(),
      author: new Types.ObjectId(authorId),
      title: 'Title',
      body: 'Body',
      status: 'draft',
      tags: ['old'],
      hidden: false,
      likeCount: 0,
      commentCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      save: jest.fn().mockResolvedValue(undefined),
    };
    posts.findById.mockReturnValue(query(post));
    users.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({ _id: post.author, name: 'Author' }),
    });

    const result = await service.updatePost(post._id, authorId, { tags: [] });

    expect(post.tags).toEqual([]);
    expect(post.title).toBe('Title');
    expect(post.save).toHaveBeenCalledTimes(1);
    expect(result.tags).toEqual([]);
  });

  it('rejects post edits by a non-owner', async () => {
    posts.findById.mockReturnValue(query({ _id: id(), author: id() }));
    await expect(
      service.updatePost(id(), id().toString(), { title: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updates title, body and status for the owning author', async () => {
    const authorId = id().toString();
    const post = {
      _id: id(),
      author: new Types.ObjectId(authorId),
      title: 'Old title',
      body: 'Old body',
      status: 'draft',
      tags: [],
      hidden: false,
      likeCount: 0,
      commentCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      save: jest.fn().mockResolvedValue(undefined),
    };
    posts.findById.mockReturnValue(query(post));
    users.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({ _id: post.author, name: 'Author' }),
    });

    const response = await service.updatePost(post._id, authorId, {
      title: 'New title',
      body: 'New body',
      status: PostStatus.Published,
    });

    expect(post).toMatchObject({
      title: 'New title',
      body: 'New body',
      status: 'published',
    });
    expect(response.status).toBe('published');
  });

  it('deletes owned post, comments and likes transactionally, then removes its stored images', async () => {
    const postId = id();
    const authorId = id().toString();
    const post = {
      author: new Types.ObjectId(authorId),
      images: [{ storageKey: 'a.jpg' }],
    };
    posts.findById.mockReturnValue(query(post));
    comments.deleteMany.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 2 }),
    });
    likes.deleteMany.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    });
    posts.deleteOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    });

    await service.deletePost(postId, authorId);

    expect(comments.deleteMany).toHaveBeenCalledWith(
      { post: postId },
      expect.objectContaining({ session: expect.any(Object) }),
    );
    expect(likes.deleteMany).toHaveBeenCalledWith(
      { post: postId },
      expect.objectContaining({ session: expect.any(Object) }),
    );
    expect(cleanupRecords.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          postId,
          storageKeys: ['a.jpg'],
        }),
      ],
      expect.objectContaining({ session: expect.any(Object) }),
    );
    expect(uploads.removeImages).toHaveBeenCalledWith(['a.jpg']);
    expect(cleanupRecords.deleteOne).toHaveBeenCalledWith({
      postId,
      author: new Types.ObjectId(authorId),
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('keeps the cleanup journal after file removal fails and retries it idempotently', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const postId = id();
    const authorId = id().toString();
    posts.findById.mockReturnValue(
      query({
        author: new Types.ObjectId(authorId),
        images: [{ storageKey: 'retry.jpg' }],
      }),
    );
    comments.deleteMany.mockReturnValue({
      exec: jest.fn().mockResolvedValue({}),
    });
    likes.deleteMany.mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
    posts.deleteOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    });
    uploads.removeImages.mockRejectedValueOnce(
      new Error('temporary file error'),
    );

    await expect(service.deletePost(postId, authorId)).rejects.toThrow(
      'Retry the delete request',
    );
    expect(cleanupRecords.create).toHaveBeenCalledTimes(1);
    expect(cleanupRecords.deleteOne).not.toHaveBeenCalled();

    cleanupRecords.findOne.mockReturnValue(
      query({ storageKeys: ['retry.jpg'] }),
    );
    await expect(service.deletePost(postId, authorId)).resolves.toBeUndefined();
    expect(posts.findById).toHaveBeenCalledTimes(1);
    expect(uploads.removeImages).toHaveBeenNthCalledWith(2, ['retry.jpg']);
    expect(cleanupRecords.deleteOne).toHaveBeenCalledWith({
      postId,
      author: new Types.ObjectId(authorId),
    });
  });

  it('does not remove files when the database transaction fails before commit', async () => {
    const postId = id();
    const authorId = id().toString();
    posts.findById.mockReturnValue(
      query({
        author: new Types.ObjectId(authorId),
        images: [{ storageKey: 'uncommitted.jpg' }],
      }),
    );
    comments.deleteMany.mockReturnValue({
      exec: jest.fn().mockResolvedValue({}),
    });
    likes.deleteMany.mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
    posts.deleteOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    });
    transaction.mockImplementation(
      async (callback: (session: object) => unknown) => {
        await callback({ transaction: true });
        throw new Error('simulated transaction commit failure');
      },
    );

    await expect(service.deletePost(postId, authorId)).rejects.toThrow(
      'simulated transaction commit failure',
    );
    expect(uploads.removeImages).not.toHaveBeenCalled();
  });

  it('does not clean files when an owner check fails', async () => {
    posts.findById.mockReturnValue(query({ author: id(), images: [] }));
    await expect(
      service.deletePost(id(), id().toString()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(uploads.removeImages).not.toHaveBeenCalled();
  });

  it('returns not found when deleting a missing post', async () => {
    posts.findById.mockReturnValue(query(null));
    await expect(
      service.deletePost(id(), id().toString()),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(comments.deleteMany).not.toHaveBeenCalled();
  });

  it('creates a like and returns the updated count', async () => {
    const post = { likeCount: 3 };
    posts.findOneAndUpdate.mockReturnValue(query(post));
    likes.create.mockResolvedValue([]);

    await expect(service.likePost(id(), id().toString())).resolves.toEqual({
      likeCount: 3,
    });
    expect(posts.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'published', hidden: false }),
      { $inc: { likeCount: 1 } },
      expect.objectContaining({ session: expect.any(Object) }),
    );
    expect(likes.create).toHaveBeenCalledTimes(1);
  });

  it('maps the unique-index duplicate-like error to conflict', async () => {
    posts.findOneAndUpdate.mockReturnValue(query({ likeCount: 1 }));
    likes.create.mockRejectedValue({ code: 11000 });
    await expect(
      service.likePost(id(), id().toString()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('declares the database-level unique post/user like index', () => {
    expect(LikeSchema.indexes()).toContainEqual([
      { post: 1, user: 1 },
      { unique: true, background: true },
    ]);
  });

  it('rejects likes on hidden or unpublished posts', async () => {
    posts.findOneAndUpdate.mockReturnValue(query(null));
    await expect(
      service.likePost(id(), id().toString()),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(likes.create).not.toHaveBeenCalled();
  });

  it('unlikes only the current user and decrements the count once', async () => {
    posts.exists.mockReturnValue(query({ _id: id() }));
    likes.findOneAndDelete.mockReturnValue(query({ _id: id() }));
    posts.findOneAndUpdate.mockReturnValue(query({ likeCount: 2 }));
    await expect(service.unlikePost(id(), id().toString())).resolves.toEqual({
      likeCount: 2,
    });
    expect(likes.findOneAndDelete).toHaveBeenCalledTimes(1);
    expect(posts.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ likeCount: { $gt: 0 } }),
      { $inc: { likeCount: -1 } },
      expect.objectContaining({ session: expect.any(Object) }),
    );
  });

  it('does not decrement when the user has no like', async () => {
    posts.exists.mockReturnValue(query({ _id: id() }));
    likes.findOneAndDelete.mockReturnValue(query(null));
    await expect(
      service.unlikePost(id(), id().toString()),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(posts.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rolls back an unlike when the post count cannot be decremented', async () => {
    posts.exists.mockReturnValue(query({ _id: id() }));
    likes.findOneAndDelete.mockReturnValue(query({ _id: id() }));
    posts.findOneAndUpdate.mockReturnValue(query(null));

    await expect(
      service.unlikePost(id(), id().toString()),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(likes.findOneAndDelete).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('rolls the comment counter back when transactional comment creation fails', async () => {
    const postId = id();
    posts.findOneAndUpdate.mockReturnValue(query({ _id: postId }));
    comments.create.mockRejectedValue(new Error('comment insert failed'));

    await expect(
      service.createComment(postId, id().toString(), { text: 'hello' }),
    ).rejects.toThrow('comment insert failed');
    expect(posts.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'published', hidden: false }),
      { $inc: { commentCount: 1 } },
      expect.objectContaining({ session: expect.any(Object) }),
    );
    expect(comments.create).toHaveBeenCalledWith(
      [expect.objectContaining({ post: postId, text: 'hello', hidden: false })],
      expect.objectContaining({ session: expect.any(Object) }),
    );
  });

  it('updates an owned comment with trimmed text and returns public fields only', async () => {
    const authorId = id().toString();
    const comment = {
      _id: id(),
      author: new Types.ObjectId(authorId),
      text: '  updated  ',
      createdAt: new Date(),
      updatedAt: new Date(),
      hidden: true,
    };
    comments.findById.mockReturnValue(query(comment));
    comments.findOneAndUpdate.mockReturnValue(
      query({ ...comment, text: 'updated' }),
    );
    users.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest
        .fn()
        .mockResolvedValue({ _id: comment.author, name: 'Author' }),
    });

    const response = await service.updateComment(comment._id, authorId, {
      text: '  updated  ',
    });
    expect(comments.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: comment._id, author: new Types.ObjectId(authorId) },
      { $set: { text: 'updated' } },
      expect.objectContaining({ new: true, runValidators: true }),
    );
    expect(response).not.toHaveProperty('hidden');
    expect(response.text).toBe('updated');
  });

  it('rejects comment edits by another user', async () => {
    comments.findById.mockReturnValue(query({ author: id() }));
    await expect(
      service.updateComment(id(), id().toString(), { text: 'new' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(comments.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('deletes an owned comment and decrements its parent count with a nonnegative guard', async () => {
    const authorId = id().toString();
    const comment = { author: new Types.ObjectId(authorId), post: id() };
    comments.findById.mockReturnValue(query(comment));
    comments.findOneAndDelete.mockReturnValue(query(comment));
    posts.findOneAndUpdate.mockReturnValue(query({ _id: comment.post }));
    await service.deleteComment(id(), authorId);
    expect(posts.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ commentCount: { $gt: 0 } }),
      { $inc: { commentCount: -1 } },
      expect.objectContaining({ session: expect.any(Object) }),
    );
  });

  it('rolls back comment removal when an existing parent has a zero counter', async () => {
    const authorId = id().toString();
    const comment = { author: new Types.ObjectId(authorId), post: id() };
    comments.findById.mockReturnValue(query(comment));
    comments.findOneAndDelete.mockReturnValue(query(comment));
    posts.findOneAndUpdate.mockReturnValue(query(null));
    posts.exists.mockReturnValue(query({ _id: comment.post }));

    await expect(service.deleteComment(id(), authorId)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(comments.findOneAndDelete).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('returns an empty paginated search and builds safe published visibility and ranking filters', async () => {
    const aggregate = {
      exec: jest.fn().mockResolvedValue([{ items: [], metadata: [] }]),
    };
    posts.aggregate.mockReturnValue(aggregate);
    users.collection = { name: 'users' } as never;
    const result = await service.listPublished({
      page: 2,
      keyword: 'a.*',
      tag: 'Travel',
    });
    const pipeline = posts.aggregate.mock.calls[0][0] as Array<
      Record<string, unknown>
    >;
    expect(result.items).toEqual([]);
    expect(result.page).toBe(2);
    expect(pipeline[0]).toEqual({
      $match: {
        status: 'published',
        hidden: false,
        tags: { $regex: '^Travel$', $options: 'i' },
      },
    });
    expect(JSON.stringify(pipeline)).toContain('a\\\\.\\\\*');
    expect(JSON.stringify(pipeline)).toContain('interactionScore');
    expect(JSON.stringify(pipeline)).toContain('authorRecord.status');
    const keywordMatch = JSON.stringify(pipeline[4]);
    expect(keywordMatch).toContain('title');
    expect(keywordMatch).toContain('tags');
    expect(keywordMatch).toContain('authorRecord.name');
    expect(keywordMatch).toContain('"$options":"i"');
    const visibilityMatch = JSON.stringify(pipeline[3]);
    expect(visibilityMatch).toContain('authorRecord.status');
    expect(visibilityMatch).toContain('deactivated');
    const facet = pipeline[pipeline.length - 1].$facet as {
      items: Array<Record<string, unknown>>;
    };
    expect(facet.items[0]).toEqual({
      $sort: { interactionScore: -1, createdAt: -1, _id: -1 },
    });
    expect(facet.items[1]).toEqual({ $skip: 10 });
    expect(facet.items[2]).toEqual({ $limit: 10 });
  });

  it('keeps ordinary browsing newest-first and applies the tag filter without keyword ranking', async () => {
    const aggregate = {
      exec: jest
        .fn()
        .mockResolvedValue([{ items: [], metadata: [{ total: 0 }] }]),
    };
    posts.aggregate.mockReturnValue(aggregate);
    users.collection = { name: 'users' } as never;

    const result = await service.listPublished({ page: 1, tag: 'egypt' });
    const pipeline = posts.aggregate.mock.calls[0][0] as Array<
      Record<string, unknown>
    >;
    const facet = pipeline[pipeline.length - 1].$facet as {
      items: Array<Record<string, unknown>>;
    };

    expect(result).toMatchObject({ items: [], total: 0, totalPages: 0 });
    expect(pipeline[0]).toEqual({
      $match: {
        status: 'published',
        hidden: false,
        tags: { $regex: '^egypt$', $options: 'i' },
      },
    });
    expect(facet.items[0]).toEqual({ $sort: { createdAt: -1, _id: -1 } });
    expect(pipeline.some((stage) => '$addFields' in stage)).toBe(false);
  });
});
