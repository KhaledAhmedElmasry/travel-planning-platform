import { Types } from 'mongoose';
import { BlogService } from './blog.service';
import { PostStatus } from './schemas/post.schema';

function query<T>(result: T) {
  return {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(result),
  };
}

describe('BlogService BLG-03', () => {
  const userId = new Types.ObjectId();
  const otherUserId = new Types.ObjectId();
  const draftId = new Types.ObjectId();
  const publishedId = new Types.ObjectId();
  const draftDate = new Date('2026-11-02T10:00:00.000Z');
  const publishedDate = new Date('2026-11-01T10:00:00.000Z');
  let postModel: Record<string, jest.Mock>;
  let service: BlogService;

  const draft = {
    _id: draftId,
    author: userId,
    title: 'Draft trip',
    status: PostStatus.Draft,
    createdAt: draftDate,
    likeCount: 0,
    commentCount: 0,
    hidden: true,
  };
  const published = {
    _id: publishedId,
    author: userId,
    title: 'Published trip',
    status: PostStatus.Published,
    createdAt: publishedDate,
    likeCount: 4,
    commentCount: 2,
    hidden: false,
  };

  beforeEach(() => {
    postModel = {
      find: jest.fn(),
      countDocuments: jest.fn(),
    };
    service = new BlogService(postModel as never, {} as never);
  });

  it("includes the user's draft and published posts when status is omitted", async () => {
    postModel.find.mockReturnValue(query([draft, published]));
    postModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(2),
    });

    const result = await service.listMine(userId.toString());

    expect(result.items.map((item) => item.status)).toEqual([
      PostStatus.Draft,
      PostStatus.Published,
    ]);
  });

  it('queries and counts only posts owned by the authenticated user', async () => {
    postModel.find.mockReturnValue(query([draft, published]));
    postModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(2),
    });

    await service.listMine(userId.toString());

    const expectedFilter = { author: userId };
    expect(postModel.find).toHaveBeenCalledWith(expectedFilter);
    expect(postModel.countDocuments).toHaveBeenCalledWith(expectedFilter);
    expect(postModel.find).not.toHaveBeenCalledWith({ author: otherUserId });
  });

  it.each([
    [PostStatus.Draft, [draft]],
    [PostStatus.Published, [published]],
  ])('filters by status %s', async (status, posts) => {
    postModel.find.mockReturnValue(query(posts));
    postModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(posts.length),
    });

    const result = await service.listMine(userId.toString(), 1, status);

    expect(postModel.find).toHaveBeenCalledWith({ author: userId, status });
    expect(result.items.map((item) => item.status)).toEqual([status]);
  });

  it('orders newest first and paginates at 10 items per page', async () => {
    const postsQuery = query([published]);
    postModel.find.mockReturnValue(postsQuery);
    postModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(21),
    });

    const result = await service.listMine(userId.toString(), 2);

    expect(postsQuery.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    expect(postsQuery.skip).toHaveBeenCalledWith(10);
    expect(postsQuery.limit).toHaveBeenCalledWith(10);
    expect(result).toMatchObject({
      page: 2,
      pageSize: 10,
      total: 21,
      totalPages: 3,
    });
  });

  it('returns only the documented summary fields', async () => {
    postModel.find.mockReturnValue(query([draft]));
    postModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(1),
    });

    const result = await service.listMine(userId.toString());

    expect(result.items[0]).toEqual({
      id: draftId.toString(),
      title: 'Draft trip',
      status: PostStatus.Draft,
      date: draftDate,
      likeCount: 0,
      commentCount: 0,
    });
    expect(result.items[0]).not.toHaveProperty('author');
    expect(result.items[0]).not.toHaveProperty('hidden');
    expect(result.items[0]).not.toHaveProperty('body');
  });

  it('returns the standard empty page for a user with no matching posts', async () => {
    postModel.find.mockReturnValue(query([]));
    postModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });

    await expect(service.listMine(userId.toString())).resolves.toEqual({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0,
    });
  });
});
