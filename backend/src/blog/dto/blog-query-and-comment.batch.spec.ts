import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListPostsQueryDto } from './list-posts-query.dto';
import { UpdateCommentDto } from './update-comment.dto';

describe('Blog batch DTO validation', () => {
  it('accepts a trimmed keyword, optional tag and shared page value', async () => {
    const dto = plainToInstance(ListPostsQueryDto, {
      keyword: '  coast  ',
      tag: '  travel  ',
      page: '2',
    });
    expect(dto.keyword).toBe('coast');
    expect(dto.tag).toBe('travel');
    expect(await validate(dto)).toHaveLength(0);
  });

  it('treats blank search terms as omitted', async () => {
    const dto = plainToInstance(ListPostsQueryDto, { keyword: '  ', tag: '' });
    expect(dto.keyword).toBeUndefined();
    expect(dto.tag).toBeUndefined();
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects invalid pagination and non-string search terms', async () => {
    const dto = plainToInstance(ListPostsQueryDto, { page: '0', keyword: 9 });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });

  it('accepts comment text at the 500-character boundary', async () => {
    const dto = plainToInstance(UpdateCommentDto, { text: 'a'.repeat(500) });
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each(['', '   ', 'a'.repeat(501), 5, null])(
    'rejects invalid comment text: %p',
    async (text) => {
      const dto = plainToInstance(UpdateCommentDto, { text });
      expect((await validate(dto)).length).toBeGreaterThan(0);
    },
  );
});
