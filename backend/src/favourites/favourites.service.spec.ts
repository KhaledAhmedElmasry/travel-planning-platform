import { Types } from 'mongoose';
import { FavouritesService } from './favourites.service';
import { FavouriteType } from './schemas/favourite.schema';

// Only the database model and the two summary lookups are faked.
function setup(
  rows: Array<{ id: string; type: FavouriteType; targetId: Types.ObjectId }>,
) {
  const find = jest.fn().mockReturnValue({
    sort: () => ({ exec: () => Promise.resolve(rows) }),
  });
  const hotel = { id: 'h', name: 'Nile View' };
  const service = new FavouritesService(
    { find } as never,
    { findFavouriteSummary: jest.fn().mockResolvedValue(hotel) } as never,
    { findPublicFavouriteSummary: jest.fn().mockResolvedValue(null) } as never,
  );
  return { service, find };
}

const userId = '665f1c2a9b1e8a0012345671';
const hotelId = '665f1c2a9b1e8a0012345672';

describe('FavouritesService.list', () => {
  // source: team leader decision 24 Nov - favourites lookup: filter on the existing list by item
  it('filters to the current user, the type and the targetId when both are given', async () => {
    const row = {
      id: 'f1',
      type: FavouriteType.Hotel,
      targetId: new Types.ObjectId(hotelId),
    };
    const { service, find } = setup([row]);

    const page = await service.list(userId, {
      page: 1,
      type: FavouriteType.Hotel,
      targetId: hotelId,
    });

    expect(find).toHaveBeenCalledWith({
      userId: new Types.ObjectId(userId),
      type: FavouriteType.Hotel,
      targetId: new Types.ObjectId(hotelId),
    });
    expect(page).toMatchObject({
      total: 1,
      items: [{ id: 'f1', targetId: hotelId }],
    });
  });

  // source: team leader decision 24 Nov - without the params the list works exactly as today
  it('without filters asks only for the current user', async () => {
    const { service, find } = setup([]);

    const page = await service.list(userId, { page: 1 });

    expect(find).toHaveBeenCalledWith({ userId: new Types.ObjectId(userId) });
    expect(page).toEqual({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0,
    });
  });

  // source: team leader decision 24 Nov - targetId alone also filters (type optional)
  it('filters by targetId alone', async () => {
    const { service, find } = setup([]);

    await service.list(userId, { page: 1, targetId: hotelId });

    expect(find).toHaveBeenCalledWith({
      userId: new Types.ObjectId(userId),
      targetId: new Types.ObjectId(hotelId),
    });
  });
});
