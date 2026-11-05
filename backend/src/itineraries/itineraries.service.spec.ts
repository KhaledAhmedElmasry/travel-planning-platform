import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ItineraryDocument } from './schemas/itinerary.schema';
import { ItinerariesService } from './itineraries.service';

describe('ItinerariesService (ITN-03)', () => {
  const userId = new Types.ObjectId().toHexString();
  const itinerary = {
    id: 'itinerary-id',
    title: 'Egypt escape',
    countryCodes: ['EG'],
    startDate: new Date('2026-12-01T00:00:00.000Z'),
    visibility: 'private',
    days: [],
    transportCosts: [],
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-02T00:00:00.000Z'),
  } as unknown as ItineraryDocument;

  function service(
    model: Record<string, jest.Mock>,
    connection = {} as never,
    users = undefined,
  ): ItinerariesService {
    return new ItinerariesService(model as never, connection, undefined, users);
  }

  it("paginates the current user's itineraries ten at a time", async () => {
    const query = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([itinerary]),
    };
    const model = {
      find: jest.fn().mockReturnValue(query),
      countDocuments: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(11),
      }),
    };

    await expect(service(model).list(userId, 2)).resolves.toEqual({
      items: [
        {
          id: 'itinerary-id',
          title: 'Egypt escape',
          countryCodes: ['EG'],
          startDate: '2026-12-01',
          numberOfDays: 0,
          visibility: 'private',
        },
      ],
      page: 2,
      pageSize: 10,
      total: 11,
      totalPages: 2,
    });
    expect(query.sort).toHaveBeenCalledWith({ updatedAt: -1 });
    expect(query.skip).toHaveBeenCalledWith(10);
    expect(query.limit).toHaveBeenCalledWith(10);
  });

  it('returns the standard friendly empty page', async () => {
    const query = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    const model = {
      find: jest.fn().mockReturnValue(query),
      countDocuments: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      }),
    };

    await expect(service(model).list(userId)).resolves.toEqual({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0,
    });
  });

  it('updates visibility for the owner', async () => {
    const itineraryId = new Types.ObjectId().toHexString();
    const save = jest.fn().mockResolvedValue(itinerary);
    const model = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(itinerary),
      }),
    };
    itinerary.save = save;

    await expect(
      service(model).update(itineraryId, userId, { visibility: 'public' }),
    ).resolves.toMatchObject({ visibility: 'public' });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid visibility value with a clear 400', async () => {
    const itineraryId = new Types.ObjectId().toHexString();
    const model = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(itinerary),
      }),
    };

    await expect(
      service(model).update(itineraryId, userId, {
        visibility: 'unlisted' as never,
      }),
    ).rejects.toThrow('Visibility must be either private or public.');
  });

  it("returns 404 when another user updates the itinerary's visibility", async () => {
    const itineraryId = new Types.ObjectId().toHexString();
    const model = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    };

    await expect(
      service(model).update(itineraryId, new Types.ObjectId().toHexString(), {
        visibility: 'public',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('lists only public, non-hidden itineraries for guests', async () => {
    const publicItinerary = {
      ...itinerary,
      visibility: 'public',
    } as ItineraryDocument;
    const query = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([publicItinerary]),
    };
    const model = {
      find: jest.fn().mockReturnValue(query),
      countDocuments: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      }),
    };

    await expect(service(model).searchPublic()).resolves.toMatchObject({
      items: [{ id: 'itinerary-id', visibility: 'public' }],
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });
    expect(model.find).toHaveBeenCalledWith({
      visibility: 'public',
      hidden: { $ne: true },
    });
  });

  it('rejects a duration range whose minimum exceeds its maximum', async () => {
    await expect(
      service({}).searchPublic({ minDays: 8, maxDays: 3 }),
    ).rejects.toThrow('minDays cannot be greater than maxDays.');
  });

  it('combines escaped keyword, place and duration filters', async () => {
    const referenceCursor = {
      toArray: jest
        .fn()
        .mockResolvedValueOnce([{ _id: 'EG' }])
        .mockResolvedValueOnce([{ _id: 'cairo' }])
        .mockResolvedValueOnce([{ _id: 'EG' }])
        .mockResolvedValueOnce([{ _id: 'cairo' }]),
    };
    const connection = {
      collection: jest.fn().mockReturnValue({
        find: jest.fn().mockReturnValue(referenceCursor),
      }),
    };
    const query = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    type SearchFilter = {
      $and?: unknown[];
      visibility?: string;
      hidden?: unknown;
      [key: string]: unknown;
    };
    let capturedFilter: SearchFilter | undefined;
    const model = {
      find: jest.fn((filter: SearchFilter) => {
        capturedFilter = filter;
        return query;
      }),
      countDocuments: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      }),
    };

    await service(model, connection as never).searchPublic({
      keyword: 'cairo.+',
      minDays: 2,
      maxDays: 5,
      country: 'EG',
      city: 'cairo',
    });

    const filter = capturedFilter;
    if (!filter) throw new Error('The search filter was not captured.');
    expect(filter).toMatchObject({
      visibility: 'public',
      hidden: { $ne: true },
    });
    expect(JSON.stringify(filter)).toContain('cairo\\\\.\\\\+');
    expect(filter.$and).toHaveLength(4);
  });

  it('does not expose a private public-detail itinerary', async () => {
    const model = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    };
    await expect(
      service(model).getPublic(new Types.ObjectId()),
    ).rejects.toThrow('Itinerary not found, private or hidden.');
  });

  it('returns 404 when the itinerary belongs to another user', async () => {
    const model = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    };

    await expect(
      service(model).getOne(new Types.ObjectId(), userId),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns 400 for a malformed itinerary id', async () => {
    await expect(
      service({}).getOne('not-an-object-id', userId),
    ).rejects.toThrow(BadRequestException);
  });
});
