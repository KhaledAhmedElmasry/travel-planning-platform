import { Types } from 'mongoose';
import { ItinerariesService } from './itineraries.service';

function makeQuery<T>(value: T) {
  const query = {
    sort: jest.fn(),
    skip: jest.fn(),
    limit: jest.fn(),
    exec: jest.fn().mockResolvedValue(value),
  };
  query.sort.mockReturnValue(query);
  query.skip.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return query;
}

describe('ItinerariesService.listPublicByAuthor', () => {
  const authorId = new Types.ObjectId('665f1c2a9b1e8a0012345678');

  it('returns only public visible author itineraries with shared pagination and newest-first ordering', async () => {
    const itinerary = {
      _id: new Types.ObjectId('665f1c2a9b1e8a0012340001'),
      id: '665f1c2a9b1e8a0012340001',
      title: 'Alexandria weekend',
      countryCodes: ['EG'],
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      days: [{}, {}],
      visibility: 'public' as const,
    };
    const findQuery = makeQuery([itinerary]);
    const countQuery = makeQuery(11);
    const deactivatedIds = [new Types.ObjectId()];
    const itineraryModel = {
      find: jest.fn().mockReturnValue(findQuery),
      countDocuments: jest.fn().mockReturnValue(countQuery),
    };
    const service = Object.assign(
      Object.create(ItinerariesService.prototype) as object,
      {
        deactivatedUserIds: jest.fn().mockResolvedValue(deactivatedIds),
        itineraryModel,
      },
    ) as unknown as ItinerariesService;

    const response = await service.listPublicByAuthor(authorId, 2);

    expect(itineraryModel.find).toHaveBeenCalledWith({
      userId: {
        $eq: authorId,
        $nin: deactivatedIds,
      },
      visibility: 'public',
      hidden: { $ne: true },
    });
    expect(findQuery.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    expect(findQuery.skip).toHaveBeenCalledWith(10);
    expect(findQuery.limit).toHaveBeenCalledWith(10);
    expect(response).toMatchObject({
      page: 2,
      pageSize: 10,
      total: 11,
      totalPages: 2,
    });
    expect(response.items[0]).toMatchObject({
      title: 'Alexandria weekend',
      countryCodes: ['EG'],
      visibility: 'public',
    });
  });

  it('returns the shared empty-page shape for an author with no public itineraries', async () => {
    const query = makeQuery([]);
    const itineraryModel = {
      find: jest.fn().mockReturnValue(query),
      countDocuments: jest.fn().mockReturnValue(makeQuery(0)),
    };
    const service = Object.assign(
      Object.create(ItinerariesService.prototype) as object,
      {
        deactivatedUserIds: jest.fn().mockResolvedValue([]),
        itineraryModel,
      },
    ) as unknown as ItinerariesService;

    await expect(service.listPublicByAuthor(authorId, 4)).resolves.toEqual({
      items: [],
      page: 4,
      pageSize: 10,
      total: 0,
      totalPages: 0,
    });
  });
});
