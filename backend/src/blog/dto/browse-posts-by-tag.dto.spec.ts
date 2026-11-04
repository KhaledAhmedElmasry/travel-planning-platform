import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { BrowsePostsByTagDto } from './browse-posts-by-tag.dto';

describe('BrowsePostsByTagDto and pagination query', () => {
  it('accepts a trimmed tag and a positive integer page', async () => {
    const params = plainToInstance(BrowsePostsByTagDto, { tag: ' egypt ' });
    const query = plainToInstance(PaginationQueryDto, { page: '2' });

    await expect(validate(params)).resolves.toHaveLength(0);
    await expect(validate(query)).resolves.toHaveLength(0);
    expect(params.tag).toBe('egypt');
    expect(query.page).toBe(2);
  });

  it('rejects blank and overlong tags', async () => {
    for (const tag of [' ', 'x'.repeat(31)]) {
      expect(
        await validate(plainToInstance(BrowsePostsByTagDto, { tag })),
      ).not.toHaveLength(0);
    }
  });

  it('rejects page values below one and fractional values', async () => {
    for (const page of ['0', '1.5', '-1']) {
      expect(
        await validate(plainToInstance(PaginationQueryDto, { page })),
      ).not.toHaveLength(0);
    }
  });
});
