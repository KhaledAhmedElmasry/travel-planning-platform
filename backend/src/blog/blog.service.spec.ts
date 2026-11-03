import { NotFoundException } from '@nestjs/common';
import { BlogService } from './blog.service';
import { PostStatus } from './schemas/post.schema';

describe('BlogService (BLG-01)', () => {
  const authorId = '665f1c2a9b1e8a0012340001';
  const authorObjectId = { toString: () => authorId };
  const postId = '665f1c2a9b1e8a0012345678';
  let postModel: { create: jest.Mock };
  let userModel: { findById: jest.Mock };
  let service: BlogService;

  beforeEach(() => {
    postModel = { create: jest.fn() };
    userModel = { findById: jest.fn() };
    userModel.findById.mockReturnValue({
      select: () => ({
        lean: () => ({
          exec: () =>
            Promise.resolve({ _id: authorObjectId, name: 'Alex Traveler' }),
        }),
      }),
    });
    postModel.create.mockResolvedValue({
      _id: { toString: () => postId },
      title: 'Cairo',
      body: 'A travel story.',
      status: PostStatus.Draft,
      tags: ['egypt'],
      author: authorId,
      hidden: false,
      likeCount: 0,
      commentCount: 0,
      createdAt: new Date('2026-11-03T10:00:00.000Z'),
      updatedAt: new Date('2026-11-03T10:00:00.000Z'),
    });
    service = new BlogService(postModel as never, userModel as never);
  });

  it('persists an authenticated author, status, tags, hidden flag and zero counts', async () => {
    const result = await service.createPost(authorId, {
      title: 'Cairo',
      body: 'A travel story.',
      status: PostStatus.Draft,
      tags: ['egypt'],
    });

    expect(postModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cairo',
        body: 'A travel story.',
        status: PostStatus.Draft,
        tags: ['egypt'],
        hidden: false,
        likeCount: 0,
        commentCount: 0,
      }),
    );
    const createCalls = postModel.create.mock.calls as unknown as Array<
      [Record<string, unknown>]
    >;
    const persisted = createCalls[0]?.[0];
    expect(String(persisted.author)).toBe(authorId);
    expect(result).toMatchObject({
      id: postId,
      author: { id: authorId, name: 'Alex Traveler' },
      status: PostStatus.Draft,
      hidden: false,
      likeCount: 0,
      commentCount: 0,
    });
  });

  it('stores missing optional tags as an empty array', async () => {
    await service.createPost(authorId, {
      title: 'Cairo',
      body: 'A travel story.',
      status: PostStatus.Published,
    });
    expect(postModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: PostStatus.Published, tags: [] }),
    );
  });

  it('does not create a post if its authenticated author cannot be found', async () => {
    userModel.findById.mockReturnValue({
      select: () => ({ lean: () => ({ exec: () => Promise.resolve(null) }) }),
    });
    await expect(
      service.createPost(authorId, {
        title: 'Cairo',
        body: 'A travel story.',
        status: PostStatus.Draft,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(postModel.create).not.toHaveBeenCalled();
  });
});
