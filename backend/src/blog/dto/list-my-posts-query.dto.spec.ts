import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PostStatus } from '../schemas/post.schema';
import { ListMyPostsQueryDto } from './list-my-posts-query.dto';

describe('ListMyPostsQueryDto', () => {
  it('accepts an optional valid status and positive integer page', async () => {
    const query = plainToInstance(ListMyPostsQueryDto, {
      status: 'draft',
      page: '2',
    });

    await expect(validate(query)).resolves.toHaveLength(0);
    expect(query.status).toBe(PostStatus.Draft);
    expect(query.page).toBe(2);
  });

  it('allows status to be omitted', async () => {
    await expect(
      validate(plainToInstance(ListMyPostsQueryDto, { page: '1' })),
    ).resolves.toHaveLength(0);
  });

  it('rejects unsupported statuses and invalid page numbers', async () => {
    for (const params of [
      { status: 'scheduled' },
      { page: '0' },
      { page: '1.5' },
      { page: '-1' },
    ]) {
      expect(
        await validate(plainToInstance(ListMyPostsQueryDto, params)),
      ).not.toHaveLength(0);
    }
  });
});
