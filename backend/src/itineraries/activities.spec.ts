import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import mongoose, { Types } from 'mongoose';
import { CreateActivityDto } from './dto/create-activity.dto';
import { ItinerariesService } from './itineraries.service';
import { ItineraryDocument, ItinerarySchema } from './schemas/itinerary.schema';

const ItineraryModel = mongoose.model(
  'ItineraryActivitiesSpec',
  ItinerarySchema,
);

describe('ItinerariesService activities (ITN-10)', () => {
  const userId = new Types.ObjectId().toHexString();
  let itinerary: ItineraryDocument;
  let save: jest.Mock;
  let findOne: jest.Mock;
  let uploads: {
    storeImage: jest.Mock;
    removeImage: jest.Mock;
    removeImages: jest.Mock;
  };
  let service: ItinerariesService;

  beforeEach(() => {
    itinerary = new ItineraryModel({
      userId: new Types.ObjectId(userId),
      title: 'Egypt escape',
      countryCodes: ['EG'],
      startDate: new Date('2027-03-01T00:00:00.000Z'),
      days: [{ cityId: 'cairo', number: 1, date: new Date('2027-03-01') }],
    });
    save = jest.fn().mockResolvedValue(itinerary);
    itinerary.save = save;
    findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(itinerary),
    });
    uploads = {
      storeImage: jest.fn().mockResolvedValue({
        id: new Types.ObjectId().toHexString(),
        url: '/uploads/images/activity.jpg',
        storageKey: 'activity.jpg',
      }),
      removeImage: jest.fn().mockResolvedValue(undefined),
      removeImages: jest.fn().mockResolvedValue(undefined),
    };
    service = new ItinerariesService(
      { findOne } as never,
      {} as never,
      uploads,
    );
  });

  const createDto: CreateActivityDto = {
    name: 'Visit the pyramids',
    description: 'Guided tour',
    time: '09:00',
    cost: 25.5,
    currency: 'USD',
  };

  it('adds an activity with its cost and currency for ITN-14 totals', async () => {
    const dayId = itinerary.days[0]._id;

    const activity = await service.addActivity(
      itinerary._id,
      dayId,
      userId,
      createDto,
    );

    expect(activity).toMatchObject({
      name: createDto.name,
      description: createDto.description,
      time: createDto.time,
      cost: createDto.cost,
      currency: createDto.currency,
    });
    expect(itinerary.days[0].activities).toHaveLength(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('rejects a cost without a currency', async () => {
    await expect(
      service.addActivity(itinerary._id, itinerary.days[0]._id, userId, {
        ...createDto,
        currency: undefined,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a negative cost and an invalid time at DTO validation', async () => {
    const errors = await validate(
      plainToInstance(CreateActivityDto, {
        ...createDto,
        cost: -1,
        time: '25:00',
      }),
    );

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['cost', 'time']),
    );
  });

  it("returns 404 when the activity belongs to another user's itinerary", async () => {
    findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

    await expect(
      service.updateActivity(new Types.ObjectId(), userId, { name: 'Changed' }),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.deleteActivity(new Types.ObjectId(), userId),
    ).rejects.toThrow(NotFoundException);
  });

  it('updates and deletes an owned activity by its id', async () => {
    const activity = await service.addActivity(
      itinerary._id,
      itinerary.days[0]._id,
      userId,
      createDto,
    );

    const updated = await service.updateActivity(
      new Types.ObjectId(activity.id),
      userId,
      { name: 'Museum visit', cost: 0 },
    );
    expect(updated).toMatchObject({
      name: 'Museum visit',
      cost: 0,
      currency: 'USD',
    });

    await service.deleteActivity(new Types.ObjectId(activity.id), userId);
    expect(itinerary.days[0].activities).toHaveLength(0);
  });

  it('attaches and removes an image only on an owned activity', async () => {
    const activity = await service.addActivity(
      itinerary._id,
      itinerary.days[0]._id,
      userId,
      createDto,
    );
    const activityId = new Types.ObjectId(activity.id);
    const uploaded = await service.attachActivityImage(activityId, userId, {
      mimetype: 'image/jpeg',
      size: 10,
      buffer: Buffer.from('jpg'),
    } as Express.Multer.File);

    expect(uploaded.id).toEqual(expect.any(String));
    expect(uploaded.url).toBe('/uploads/images/activity.jpg');
    expect(itinerary.days[0].activities[0].images).toHaveLength(1);

    await service.removeActivityImage(
      activityId,
      new Types.ObjectId(uploaded.id),
      userId,
    );
    expect(uploads.removeImages).toHaveBeenCalledWith(['activity.jpg']);
    expect(itinerary.days[0].activities[0].images).toHaveLength(0);
  });

  it('removes all activity image files when deleting a day or itinerary', async () => {
    const activity = await service.addActivity(
      itinerary._id,
      itinerary.days[0]._id,
      userId,
      createDto,
    );
    await service.attachActivityImage(new Types.ObjectId(activity.id), userId, {
      mimetype: 'image/png',
      size: 10,
      buffer: Buffer.from('png'),
    } as Express.Multer.File);

    await service.deleteDay(itinerary._id, itinerary.days[0]._id, userId);
    expect(uploads.removeImages).toHaveBeenCalledWith(['activity.jpg']);
  });

  it('rejects a sixth image through the shared upload limit', async () => {
    const activity = await service.addActivity(
      itinerary._id,
      itinerary.days[0]._id,
      userId,
      createDto,
    );
    itinerary.days[0].activities[0].images!.push(
      ...Array.from({ length: 5 }, () => ({
        _id: new Types.ObjectId(),
        url: '/uploads/images/existing.jpg',
        storageKey: 'existing.jpg',
      })),
    );

    await expect(
      service.attachActivityImage(new Types.ObjectId(activity.id), userId, {
        mimetype: 'image/jpeg',
        size: 10,
        buffer: Buffer.from('jpg'),
      } as Express.Multer.File),
    ).rejects.toThrow(BadRequestException);
  });
});
