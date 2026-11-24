import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListFavouritesQueryDto } from './list-favourites-query.dto';

// source: team leader decision 24 Nov - favourites lookup: GET /api/favourites?type=&targetId=
// (both optional; invalid type / invalid id -> 400, GEN-02)
describe('ListFavouritesQueryDto', () => {
  const errorsOf = async (query: Record<string, unknown>) =>
    (await validate(plainToInstance(ListFavouritesQueryDto, query))).map(
      ({ property }) => property,
    );

  it('accepts no filter, a type, and a type with a valid targetId', async () => {
    expect(await errorsOf({})).toEqual([]);
    expect(await errorsOf({ type: 'hotel' })).toEqual([]);
    expect(
      await errorsOf({
        type: 'itinerary',
        targetId: '665f1c2a9b1e8a0012345678',
      }),
    ).toEqual([]);
  });

  it('rejects a targetId that is not an ObjectId', async () => {
    expect(await errorsOf({ targetId: 'not-an-id' })).toEqual(['targetId']);
  });

  it('rejects an unknown type', async () => {
    expect(await errorsOf({ type: 'flight' })).toEqual(['type']);
  });
});
