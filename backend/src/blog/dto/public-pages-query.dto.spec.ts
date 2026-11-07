import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  PostDetailQueryDto,
  PublicAuthorPageQueryDto,
} from './public-pages-query.dto';

describe('public Blog page query DTOs', () => {
  it('defaults independent page parameters to 1', () => {
    expect(new PostDetailQueryDto().commentsPage).toBe(1);
    expect(new PublicAuthorPageQueryDto()).toMatchObject({
      postsPage: 1,
      itinerariesPage: 1,
    });
  });

  it('accepts positive integer query strings and preserves independent author pages', async () => {
    const authorQuery = plainToInstance(PublicAuthorPageQueryDto, {
      postsPage: '2',
      itinerariesPage: '5',
    });
    expect(await validate(authorQuery)).toHaveLength(0);
    expect(authorQuery).toMatchObject({ postsPage: 2, itinerariesPage: 5 });

    const commentsQuery = plainToInstance(PostDetailQueryDto, {
      commentsPage: '3',
    });
    expect(await validate(commentsQuery)).toHaveLength(0);
    expect(commentsQuery.commentsPage).toBe(3);
  });

  it.each(['0', '-1', '1.2', 'not-a-page'])(
    'rejects invalid page value %s',
    async (value) => {
      const authorQuery = plainToInstance(PublicAuthorPageQueryDto, {
        postsPage: value,
        itinerariesPage: value,
      });
      const authorErrors = await validate(authorQuery);
      expect(authorErrors.map(({ property }) => property)).toEqual(
        expect.arrayContaining(['postsPage', 'itinerariesPage']),
      );
      const commentsQuery = plainToInstance(PostDetailQueryDto, {
        commentsPage: value,
      });
      expect(await validate(commentsQuery)).not.toHaveLength(0);
    },
  );
});
