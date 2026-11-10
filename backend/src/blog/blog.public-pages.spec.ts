import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Role, AccountStatus } from '../common/enums';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';
import { PostStatus } from './schemas/post.schema';

function makeQuery<T>(value: T) {
  const query = {
    sort: jest.fn(),
    skip: jest.fn(),
    limit: jest.fn(),
    lean: jest.fn(),
    exec: jest.fn().mockResolvedValue(value),
  };
  query.sort.mockReturnValue(query);
  query.skip.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.lean.mockReturnValue(query);
  return query;
}

describe('Blog public detail and author pages', () => {
  const postId = new Types.ObjectId('665f1c2a9b1e8a0012340001');
  const authorId = new Types.ObjectId('665f1c2a9b1e8a0012345678');
  const commentId = new Types.ObjectId('665f1c2a9b1e8a0012340002');
  const postDate = new Date('2026-11-01T10:00:00.000Z');
  const post = {
    _id: postId,
    author: authorId,
    title: 'Cairo in a weekend',
    body: 'A practical two-day guide.',
    status: PostStatus.Published,
    tags: ['cairo'],
    images: [
      {
        id: 'image-1',
        url: 'https://example.test/image.jpg',
        storageKey: 'secret-key',
      },
    ],
    hidden: false,
    likeCount: 4,
    commentCount: 12,
    createdAt: postDate,
  };

  it('rejects invalid ObjectIds through the shared route pipe', () => {
    const pipe = new ParseObjectIdPipe();
    expect(() => pipe.transform('not-an-object-id')).toThrow(
      'not a valid MongoDB ObjectId',
    );
  });

  function makeBlogService(overrides: Record<string, unknown> = {}) {
    const postById = makeQuery(post);
    const commentsQuery = makeQuery([
      {
        _id: commentId,
        author: new Types.ObjectId('665f1c2a9b1e8a0012345680'),
        text: 'Helpful!',
        createdAt: new Date('2026-11-01T11:00:00.000Z'),
      },
    ]);
    const author = {
      _id: authorId,
      name: 'Mona Hassan',
      email: 'private@example.test',
      status: AccountStatus.Active,
      createdAt: new Date('2026-10-10T09:00:00.000Z'),
    };
    const commentModel = {
      find: jest.fn().mockReturnValue(commentsQuery),
      countDocuments: jest.fn().mockReturnValue(makeQuery(12)),
    };
    const postModel = {
      findById: jest.fn().mockReturnValue(postById),
      find: jest.fn().mockReturnValue(makeQuery([post])),
      countDocuments: jest.fn().mockReturnValue(makeQuery(11)),
    };
    const itinerariesService = {
      listPublicByAuthor: jest.fn().mockResolvedValue({
        items: [],
        page: 3,
        pageSize: 10,
        total: 0,
        totalPages: 0,
      }),
    };
    const service = Object.assign(
      Object.create(BlogService.prototype) as object,
      {
        postModel,
        commentModel,
        likeModel: {
          exists: jest.fn().mockReturnValue(makeQuery({ _id: postId })),
        },
        usersService: {
          findById: jest.fn((id: string) =>
            Promise.resolve(
              id === '665f1c2a9b1e8a0012345680'
                ? {
                    _id: new Types.ObjectId(id),
                    name: 'Deleted user',
                    status: AccountStatus.Deactivated,
                  }
                : author,
            ),
          ),
        },
        itinerariesService,
        ...overrides,
      },
    ) as unknown as BlogService;
    return {
      service,
      postById,
      commentsQuery,
      author,
      postModel,
      commentModel,
      itinerariesService,
    };
  }

  it('returns a public post to a guest, excludes storage keys and hidden comments, and shows deleted comment authors safely', async () => {
    const { service, commentsQuery, commentModel } = makeBlogService();

    const response = await service.getPostDetail(postId);

    expect(response).toMatchObject({
      id: postId.toString(),
      author: { id: authorId.toString(), name: 'Mona Hassan' },
      likeCount: 4,
      commentCount: 12,
      comments: [{ author: { name: 'Deleted user' }, text: 'Helpful!' }],
    });
    expect(response).not.toHaveProperty('likedByMe');
    expect(response.images).toEqual([
      { id: 'image-1', url: 'https://example.test/image.jpg' },
    ]);
    expect(JSON.stringify(response)).not.toContain('secret-key');
    expect(commentsQuery.sort).toHaveBeenCalledWith({ createdAt: 1, _id: 1 });
    expect(commentModel.find).toHaveBeenCalledWith({
      post: postId,
      hidden: false,
    });
    expect(commentsQuery.skip).toHaveBeenCalledWith(0);
    expect(commentsQuery.limit).toHaveBeenCalledWith(10);
  });

  it('includes likedByMe for a valid session and paginates comments independently', async () => {
    const { service, commentsQuery, commentModel } = makeBlogService();
    const viewer = {
      id: '665f1c2a9b1e8a0012345681',
      role: Role.User,
      sessionId: '665f1c2a9b1e8a0012345682',
      airlineId: null,
      hotelId: null,
      mustChangePassword: false,
      emailVerified: true,
    };

    const response = await service.getPostDetail(postId, 2, viewer);

    expect(response.likedByMe).toBe(true);
    expect(commentsQuery.skip).toHaveBeenCalledWith(10);
    expect(commentModel.find).toHaveBeenCalledWith({
      post: postId,
      $or: [
        { hidden: false },
        { hidden: true, author: new Types.ObjectId(viewer.id) },
      ],
    });
  });

  it('filters another user’s hidden comments and uses the same filter for the returned count', async () => {
    const viewerId = new Types.ObjectId('665f1c2a9b1e8a0012345681');
    const hiddenCommentId = new Types.ObjectId('665f1c2a9b1e8a0012340003');
    const visibleComment = {
      _id: commentId,
      author: new Types.ObjectId('665f1c2a9b1e8a0012345680'),
      text: 'Visible comment',
      hidden: false,
      createdAt: new Date('2026-11-01T11:00:00.000Z'),
    };
    const hiddenCommentByAnotherUser = {
      _id: hiddenCommentId,
      author: authorId,
      text: 'Private moderation comment',
      hidden: true,
      createdAt: new Date('2026-11-01T12:00:00.000Z'),
    };
    const commentsQuery = makeQuery([visibleComment]);
    const commentFilter = {
      post: postId,
      $or: [{ hidden: false }, { hidden: true, author: viewerId }],
    };
    const countQuery = makeQuery(1);
    const commentModel = {
      find: jest.fn().mockReturnValue(commentsQuery),
      countDocuments: jest.fn().mockReturnValue(countQuery),
    };
    const { service } = makeBlogService({ commentModel });
    const viewer = {
      id: viewerId.toString(),
      role: Role.User,
      sessionId: '665f1c2a9b1e8a0012345682',
      airlineId: null,
      hotelId: null,
      mustChangePassword: false,
      emailVerified: true,
    };

    const response = await service.getPostDetail(postId, 1, viewer);

    expect(commentModel.find).toHaveBeenCalledWith(commentFilter);
    expect(commentModel.countDocuments).toHaveBeenCalledWith(commentFilter);
    expect(response.comments).toHaveLength(1);
    expect(response.comments.map(({ id }) => id)).not.toContain(
      hiddenCommentByAnotherUser._id.toString(),
    );
    expect(response.commentCount).toBe(1);

    const adminCommentsQuery = makeQuery([hiddenCommentByAnotherUser]);
    const adminCommentModel = {
      find: jest.fn().mockReturnValue(adminCommentsQuery),
      countDocuments: jest.fn().mockReturnValue(makeQuery(1)),
    };
    const adminService = makeBlogService({
      commentModel: adminCommentModel,
    }).service;
    const adminResponse = await adminService.getPostDetail(postId, 1, {
      ...viewer,
      id: new Types.ObjectId().toString(),
      role: Role.Admin,
    });
    expect(adminCommentModel.find).toHaveBeenCalledWith({ post: postId });
    expect(adminResponse.comments.map(({ id }) => id)).toContain(
      hiddenCommentByAnotherUser._id.toString(),
    );
  });

  it('allows the author and an admin to view drafts but hides them from other users', async () => {
    const draft = { ...post, status: PostStatus.Draft };
    const makeDraftService = () =>
      makeBlogService({
        postModel: { findById: jest.fn().mockReturnValue(makeQuery(draft)) },
      }).service;
    const owner = {
      id: authorId.toString(),
      role: Role.User,
      sessionId: 's',
      airlineId: null,
      hotelId: null,
      mustChangePassword: false,
      emailVerified: true,
    };
    const otherUser = { ...owner, id: new Types.ObjectId().toString() };
    const admin = {
      ...owner,
      id: new Types.ObjectId().toString(),
      role: Role.Admin,
    };
    await expect(
      makeDraftService().getPostDetail(postId, 1, owner),
    ).resolves.toMatchObject({ status: PostStatus.Draft });
    await expect(
      makeDraftService().getPostDetail(postId, 1, admin),
    ).resolves.toMatchObject({ status: PostStatus.Draft });
    await expect(
      makeDraftService().getPostDetail(postId, 1, otherUser),
    ).rejects.toMatchObject({
      status: 404,
      message: 'Post not found, or a draft or hidden post of another user.',
    });
    await expect(
      makeDraftService().getPostDetail(postId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows only the owner and admin to view hidden posts', async () => {
    const hidden = { ...post, hidden: true };
    const makeHiddenService = () =>
      makeBlogService({
        postModel: { findById: jest.fn().mockReturnValue(makeQuery(hidden)) },
      }).service;
    const owner = {
      id: authorId.toString(),
      role: Role.User,
      sessionId: 's',
      airlineId: null,
      hotelId: null,
      mustChangePassword: false,
      emailVerified: true,
    };
    const other = { ...owner, id: new Types.ObjectId().toString() };
    const admin = { ...other, role: Role.Admin };
    await expect(
      makeHiddenService().getPostDetail(postId, 1, owner),
    ).resolves.toMatchObject({ status: PostStatus.Published });
    await expect(
      makeHiddenService().getPostDetail(postId, 1, admin),
    ).resolves.toMatchObject({ status: PostStatus.Published });
    await expect(
      makeHiddenService().getPostDetail(postId, 1, other),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns not found for missing posts and posts of deactivated authors', async () => {
    const missing = makeBlogService({
      postModel: { findById: jest.fn().mockReturnValue(makeQuery(null)) },
    }).service;
    await expect(missing.getPostDetail(postId)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const deactivated = makeBlogService({
      usersService: {
        findById: jest
          .fn()
          .mockResolvedValue({ status: AccountStatus.Deactivated }),
      },
    }).service;
    await expect(deactivated.getPostDetail(postId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns a safe author profile and independently paginated public posts and itineraries', async () => {
    const { service, postModel, itinerariesService } = makeBlogService();
    const response = await service.getPublicAuthorPage(authorId, 2, 3);

    expect(response.author).toEqual({
      id: authorId.toString(),
      name: 'Mona Hassan',
      createdAt: new Date('2026-10-10T09:00:00.000Z'),
    });
    expect(response.author).not.toHaveProperty('email');
    expect(response.posts).toMatchObject({ page: 2, pageSize: 10, total: 11 });
    expect(response.posts.items[0]).toEqual({
      id: postId.toString(),
      title: post.title,
      author: { id: authorId.toString(), name: 'Mona Hassan' },
      date: postDate,
      excerpt: post.body.slice(0, 200),
      tags: ['cairo'],
      likeCount: 4,
      commentCount: 12,
    });
    expect(response.itineraries.page).toBe(3);
    expect(itinerariesService.listPublicByAuthor).toHaveBeenCalledWith(
      authorId,
      3,
    );
    expect(postModel.find).toHaveBeenCalledWith({
      author: authorId,
      status: PostStatus.Published,
      hidden: false,
    });
  });

  it('returns not found for nonexistent and deactivated authors', async () => {
    const missing = makeBlogService({
      usersService: { findById: jest.fn().mockResolvedValue(null) },
    }).service;
    await expect(missing.getPublicAuthorPage(authorId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const deactivated = makeBlogService({
      usersService: {
        findById: jest
          .fn()
          .mockResolvedValue({ status: AccountStatus.Deactivated }),
      },
    }).service;
    await expect(
      deactivated.getPublicAuthorPage(authorId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns empty page envelopes for pages beyond the available data', async () => {
    const { service } = makeBlogService({
      postModel: {
        find: jest.fn().mockReturnValue(makeQuery([])),
        countDocuments: jest.fn().mockReturnValue(makeQuery(0)),
      },
      itinerariesService: {
        listPublicByAuthor: jest.fn().mockResolvedValue({
          items: [],
          page: 7,
          pageSize: 10,
          total: 0,
          totalPages: 0,
        }),
      },
    });
    const response = await service.getPublicAuthorPage(authorId, 5, 7);
    expect(response.posts).toEqual({
      items: [],
      page: 5,
      pageSize: 10,
      total: 0,
      totalPages: 0,
    });
    expect(response.itineraries).toEqual({
      items: [],
      page: 7,
      pageSize: 10,
      total: 0,
      totalPages: 0,
    });
  });

  it('keeps post detail public when the optional access cookie is absent or invalid', async () => {
    const blogService = {
      getPostDetail: jest.fn().mockResolvedValue({ id: postId.toString() }),
    };
    const sessions = {
      authenticate: jest.fn().mockRejectedValue(new UnauthorizedException()),
    };
    const controller = new BlogController(
      blogService as unknown as BlogService,
      sessions as never,
    );
    const request = { cookies: {} } as never;

    await controller.getPost(postId, { commentsPage: 1 }, request);
    expect(blogService.getPostDetail).toHaveBeenCalledWith(
      postId,
      1,
      undefined,
    );

    await controller.getPost(postId, { commentsPage: 1 }, {
      cookies: { access_token: 'invalid' },
    } as never);
    expect(blogService.getPostDetail).toHaveBeenLastCalledWith(
      postId,
      1,
      undefined,
    );
    expect(sessions.authenticate).toHaveBeenCalledWith('invalid');
  });

  it('does not hide unexpected optional-authentication failures', async () => {
    const blogService = { getPostDetail: jest.fn() };
    const sessions = {
      authenticate: jest.fn().mockRejectedValue(new Error('database failed')),
    };
    const controller = new BlogController(
      blogService as unknown as BlogService,
      sessions as never,
    );
    await expect(
      controller.getPost(postId, { commentsPage: 1 }, {
        cookies: { access_token: 'token' },
      } as never),
    ).rejects.toThrow('database failed');
  });
});
