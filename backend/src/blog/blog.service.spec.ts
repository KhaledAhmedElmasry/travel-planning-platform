import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { BlogService } from './blog.service';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostStatus } from './schemas/post.schema';
import { plainToInstance } from 'class-transformer';

function query<T>(result: T) {
  return {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(result),
  };
}

describe('BlogService BLG-08', () => {
  const authorId = new Types.ObjectId();
  const postId = new Types.ObjectId();
  const author = { _id: authorId, name: 'Alex Traveler' };
  let postModel: Record<string, jest.Mock>;
  let userModel: Record<string, jest.Mock>;
  let service: BlogService;
  let post: Record<string, unknown> & { save: jest.Mock };

  beforeEach(() => {
    post = {
      _id: postId,
      author: authorId,
      title: 'Cairo',
      body: 'A trip to Cairo',
      status: PostStatus.Published,
      tags: ['egypt'],
      hidden: false,
      likeCount: 2,
      commentCount: 1,
      createdAt: new Date('2026-11-01T10:00:00.000Z'),
      updatedAt: new Date('2026-11-01T10:00:00.000Z'),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const authorQuery = query(author);
    postModel = {
      create: jest.fn().mockResolvedValue(post),
      findById: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(post) }),
      find: jest.fn(),
      countDocuments: jest.fn(),
    };
    userModel = {
      findById: jest.fn().mockReturnValue(authorQuery),
      distinct: jest.fn(),
      find: jest.fn(),
    };
    service = new BlogService(postModel as never, userModel as never);
  });

  it('preserves BLG-01 post creation behavior', async () => {
    const result = await service.createPost(authorId.toString(), {
      title: 'Cairo',
      body: 'A trip to Cairo',
      status: PostStatus.Published,
      tags: ['egypt'],
    });

    expect(postModel.create).toHaveBeenCalledWith({
      author: authorId,
      title: 'Cairo',
      body: 'A trip to Cairo',
      status: PostStatus.Published,
      tags: ['egypt'],
      hidden: false,
      likeCount: 0,
      commentCount: 0,
    });
    expect(result.id).toBe(postId.toString());
  });

  it('adds normalized tags and returns the updated post', async () => {
    const result = await service.updatePost(postId, authorId.toString(), {
      ...plainToInstance(UpdatePostDto, { tags: ['  Egypt ', 'Cairo'] }),
    });

    expect(post.tags).toEqual(['egypt', 'cairo']);
    expect(post.save).toHaveBeenCalledTimes(1);
    expect(result.tags).toEqual(['egypt', 'cairo']);
    expect(result.author).toEqual({
      id: authorId.toString(),
      name: author.name,
    });
  });

  it('replaces the full tag list and accepts an empty list to clear tags', async () => {
    await service.updatePost(
      postId,
      authorId.toString(),
      plainToInstance(UpdatePostDto, { tags: ['new'] }),
    );
    expect(post.tags).toEqual(['new']);

    await service.updatePost(
      postId,
      authorId.toString(),
      plainToInstance(UpdatePostDto, { tags: [] }),
    );
    expect(post.tags).toEqual([]);
  });

  it('preserves fields omitted from a tags-only update', async () => {
    await service.updatePost(
      postId,
      authorId.toString(),
      plainToInstance(UpdatePostDto, { tags: ['cairo'] }),
    );

    expect(post.title).toBe('Cairo');
    expect(post.body).toBe('A trip to Cairo');
    expect(post.status).toBe(PostStatus.Published);
  });

  it('applies all fields allowed by the shared UpdatePostRequest', async () => {
    await service.updatePost(postId, authorId.toString(), {
      title: 'Updated title',
      body: 'Updated body',
      status: PostStatus.Draft,
      tags: ['history'],
    });

    expect(post.title).toBe('Updated title');
    expect(post.body).toBe('Updated body');
    expect(post.status).toBe(PostStatus.Draft);
    expect(post.tags).toEqual(['history']);
  });

  it('rejects an empty update body instead of silently succeeding', async () => {
    await expect(
      service.updatePost(postId, authorId.toString(), {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(post.save).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing post', async () => {
    postModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    await expect(
      service.updatePost(postId, authorId.toString(), { tags: ['egypt'] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the documented 403 when a different user edits the post', async () => {
    await expect(
      service.updatePost(postId, new Types.ObjectId().toString(), {
        tags: ['egypt'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(post.save).not.toHaveBeenCalled();
  });

  it('returns published visible posts matching a tag case-insensitively with pagination', async () => {
    const publicPost = {
      _id: postId,
      author: authorId,
      title: 'Cairo',
      body: 'A trip to Cairo',
      tags: ['egypt'],
      likeCount: 2,
      commentCount: 1,
      createdAt: new Date('2026-11-01T10:00:00.000Z'),
    };
    const postsQuery = query([publicPost]);
    const authorsQuery = query([author]);
    postModel.find.mockReturnValue(postsQuery);
    postModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(1),
    });
    userModel.distinct.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });
    userModel.find.mockReturnValue(authorsQuery);

    const result = await service.listPublishedByTag(' Egypt ', 2);

    const calls = postModel.find.mock.calls as unknown as unknown[][];
    const filter = calls[0]?.[0] as Record<string, unknown>;
    const tagFilter = filter.tags as { $regex: string; $options: string };
    const authorFilter = filter.author as { $nin: Types.ObjectId[] };
    expect(filter.status).toBe(PostStatus.Published);
    expect(filter.hidden).toBe(false);
    expect(tagFilter).toEqual({ $regex: '^Egypt$', $options: 'i' });
    expect(postsQuery.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    expect(postsQuery.skip).toHaveBeenCalledWith(10);
    expect(postsQuery.limit).toHaveBeenCalledWith(10);
    expect(authorFilter.$nin).toEqual([]);
    expect(result).toEqual({
      items: [
        {
          id: postId.toString(),
          title: 'Cairo',
          author: { id: authorId.toString(), name: author.name },
          date: publicPost.createdAt,
          excerpt: 'A trip to Cairo',
          tags: ['egypt'],
          likeCount: 2,
          commentCount: 1,
        },
      ],
      page: 2,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it('returns the standard empty page for an unknown tag', async () => {
    const postsQuery = query([]);
    postModel.find.mockReturnValue(postsQuery);
    postModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });
    userModel.distinct.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });

    await expect(service.listPublishedByTag('unknown')).resolves.toEqual({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0,
    });
  });

  it('excludes posts by deactivated authors', async () => {
    const deactivatedAuthorId = new Types.ObjectId();
    postModel.find.mockReturnValue(query([]));
    postModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });
    userModel.distinct.mockReturnValue({
      exec: jest.fn().mockResolvedValue([deactivatedAuthorId]),
    });

    await service.listPublishedByTag('egypt');

    const calls = postModel.find.mock.calls as unknown as unknown[][];
    const filter = calls[0]?.[0] as Record<string, unknown>;
    expect(filter.author).toEqual({ $nin: [deactivatedAuthorId] });
  });

  it('rejects blank or too-long path tags', async () => {
    await expect(service.listPublishedByTag('   ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.listPublishedByTag('x'.repeat(31)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
