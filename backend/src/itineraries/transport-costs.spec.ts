import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { TransportMode } from '../common/enums';
import { CreateTransportCostDto } from './dto/create-transport-cost.dto';
import { ItinerariesService } from './itineraries.service';

describe('ItinerariesService transport costs (ITN-16)', () => {
  const userId = new Types.ObjectId().toHexString();
  const itineraryId = new Types.ObjectId();
  const dayId = new Types.ObjectId();
  const otherDayId = new Types.ObjectId();
  const costId = new Types.ObjectId();

  function makeItinerary() {
    const day = { _id: dayId, cityId: 'cairo', number: 1 };
    const cost = {
      _id: costId,
      dayId,
      mode: TransportMode.Bus,
      fromCityId: 'cairo',
      toCityId: 'luxor',
      amount: 120,
      currency: 'USD',
    };
    return {
      _id: itineraryId,
      id: itineraryId,
      days: {
        id: jest.fn((id: string) =>
          String(id) === String(dayId) ? day : null,
        ),
        pull: jest.fn(),
        forEach: jest.fn(),
      },
      transportCosts: {
        id: jest.fn((id: string) =>
          String(id) === String(costId) ? cost : null,
        ),
        push: jest.fn(),
        pull: jest.fn(),
        map: jest.fn(() => [cost]),
      },
      save: jest.fn().mockResolvedValue(undefined),
    };
  }

  function service(
    itinerary: ReturnType<typeof makeItinerary> | null,
    cities = 2,
    currencyFound = true,
  ): ItinerariesService {
    const model = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(itinerary),
      }),
    };
    const connection = {
      collection: jest.fn((name: string) =>
        name === 'cities'
          ? { countDocuments: jest.fn().mockResolvedValue(cities) }
          : { findOne: jest.fn().mockResolvedValue(currencyFound ? {} : null) },
      ),
    };
    return new ItinerariesService(model as never, connection as never);
  }

  const createDto: CreateTransportCostDto = {
    dayId: dayId.toHexString(),
    mode: TransportMode.Train,
    fromCityId: 'cairo',
    toCityId: 'luxor',
    amount: 250.5,
    currency: 'USD',
  };

  it('creates a validated entry and returns its original amount and currency', async () => {
    const itinerary = makeItinerary();
    const result = await service(itinerary).addTransportCost(
      itineraryId,
      userId,
      createDto,
    );

    expect(result).toMatchObject({
      dayId: dayId.toHexString(),
      mode: TransportMode.Train,
      amount: 250.5,
      currency: 'USD',
    });
    expect(itinerary.transportCosts.push).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: createDto.mode,
        fromCityId: createDto.fromCityId,
        toCityId: createDto.toCityId,
        amount: createDto.amount,
        currency: createDto.currency,
      }),
    );
    expect(itinerary.save).toHaveBeenCalled();
  });

  it('rejects a day that is not part of the itinerary', async () => {
    const itinerary = makeItinerary();

    await expect(
      service(itinerary).addTransportCost(itineraryId, userId, {
        ...createDto,
        dayId: otherDayId.toHexString(),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects unknown cities and unsupported currencies', async () => {
    await expect(
      service(makeItinerary(), 1).addTransportCost(
        itineraryId,
        userId,
        createDto,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service(makeItinerary(), 2, false).addTransportCost(
        itineraryId,
        userId,
        createDto,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('finds an entry through its itinerary and returns 404 for another owner', async () => {
    await expect(
      service(null).updateTransportCost(costId, userId, { amount: 50 }),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service(null).deleteTransportCost(costId, userId),
    ).rejects.toThrow(NotFoundException);
  });

  it('updates and deletes an owned entry', async () => {
    const itinerary = makeItinerary();
    const updated = await service(itinerary).updateTransportCost(
      costId,
      userId,
      { amount: 0 },
    );

    expect(updated).toMatchObject({ amount: 0, toCityId: 'luxor' });
    expect(itinerary.save).toHaveBeenCalled();

    await service(itinerary).deleteTransportCost(costId, userId);
    expect(itinerary.transportCosts.pull).toHaveBeenCalledWith(costId);
  });

  it('removes transport entries when their day is deleted', async () => {
    const itinerary = makeItinerary();
    await service(itinerary).deleteDay(itineraryId, dayId, userId);

    expect(itinerary.transportCosts.pull).toHaveBeenCalledWith({ dayId });
  });
});
