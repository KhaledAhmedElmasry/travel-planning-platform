import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { Connection, isValidObjectId, Model, Types } from 'mongoose';
import {
  DEFAULT_PAGE_SIZE,
  emptyPaginatedList,
  getPaginationOffset,
  paginate,
  PaginatedList,
} from '../common/dto/pagination.dto';
import {
  CityGroup,
  computeCityGroups,
  dayDate,
  MAX_ITINERARY_DAYS,
  renumberDays,
} from './day-schedule';
import { CreateDayDto } from './dto/create-day.dto';
import { CreateActivityDto } from './dto/create-activity.dto';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { ReorderDaysDto } from './dto/reorder-days.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { UpdateDayDto } from './dto/update-day.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
import { CreateTransportCostDto } from './dto/create-transport-cost.dto';
import { UpdateTransportCostDto } from './dto/update-transport-cost.dto';
import {
  Itinerary,
  ItineraryDay,
  ItineraryDocument,
  Activity,
  TransportCost,
} from './schemas/itinerary.schema';

// Area: Itineraries
// Business logic and database access for: ITN-01..ITN-26
@Injectable()
export class ItinerariesService {
  constructor(
    @InjectModel(Itinerary.name)
    private readonly itineraryModel: Model<Itinerary>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async create(
    userId: string,
    dto: CreateItineraryDto,
  ): Promise<ItineraryResponse> {
    await this.assertCountriesExist(dto.countryCodes);
    const itinerary = await this.itineraryModel.create({
      userId: new Types.ObjectId(userId),
      title: dto.title,
      countryCodes: dto.countryCodes,
      startDate: toStartDate(dto.startDate),
    });
    return this.toResponse(itinerary);
  }

  async update(
    itineraryId: string,
    userId: string,
    dto: UpdateItineraryDto,
  ): Promise<ItineraryResponse> {
    const itinerary = await this.findOwnedOrThrow(itineraryId, userId);
    if (dto.countryCodes !== undefined) {
      await this.assertCountriesExist(dto.countryCodes);
      itinerary.countryCodes = dto.countryCodes;
    }
    if (dto.title !== undefined) itinerary.title = dto.title;
    if (dto.startDate !== undefined) {
      itinerary.startDate = toStartDate(dto.startDate);
      // Changing the start date moves the dates of all days (openapi.yaml, PATCH /itineraries/{id}).
      renumberDays(itinerary.days, itinerary.startDate);
    }

    try {
      await itinerary.save();
    } catch (error) {
      if (error instanceof mongoose.Error.VersionError) {
        throw new ConflictException(
          'The itinerary was changed by another request. Please retry.',
        );
      }
      throw error;
    }
    return this.toResponse(itinerary);
  }

  // ITN-05: adds a day at the end. Its number and date come from renumberDays.
  async addDay(
    itineraryId: string | Types.ObjectId,
    userId: string,
    dto: CreateDayDto,
  ): Promise<DayResponse> {
    await this.assertCityExists(dto.cityId);
    const ownerId = new Types.ObjectId(userId);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const itinerary = await this.findOwnedOrThrow(itineraryId, userId);
      const dayCount = itinerary.days.length;
      if (dayCount >= MAX_ITINERARY_DAYS) {
        throw new ConflictException(
          `The itinerary already has ${MAX_ITINERARY_DAYS} days.`,
        );
      }

      const day = {
        _id: new Types.ObjectId(),
        cityId: dto.cityId,
        notes: dto.notes ?? '',
        activities: [],
        number: dayCount + 1,
        date: dayDate(itinerary.startDate, dayCount + 1),
      };
      const result = await this.itineraryModel
        .updateOne(
          {
            _id: itinerary._id,
            userId: ownerId,
            days: { $size: dayCount },
          },
          { $push: { days: day } },
        )
        .exec();

      if (result.matchedCount === 1) return toDayResponse(day);
    }

    throw new ConflictException(
      'The itinerary was changed by another request. Please retry.',
    );
  }

  // ITN-05: edits the city and / or notes of one day. Position and date are unchanged, but the
  // days are still renumbered so every day change goes through the same helper.
  async updateDay(
    itineraryId: string | Types.ObjectId,
    dayId: string | Types.ObjectId,
    userId: string,
    dto: UpdateDayDto,
  ): Promise<DayResponse> {
    const itinerary = await this.findOwnedOrThrow(itineraryId, userId);
    const day = isValidObjectId(dayId) ? itinerary.days.id(dayId) : null;
    if (!day) throw dayNotFound();
    if (dto.cityId === undefined && dto.notes === undefined) {
      throw new BadRequestException('At least one day field is required.');
    }

    if (dto.cityId !== undefined) {
      await this.assertCityExists(dto.cityId);
      day.cityId = dto.cityId;
    }
    if (dto.notes !== undefined) day.notes = dto.notes;

    renumberDays(itinerary.days, itinerary.startDate);
    try {
      await itinerary.save();
    } catch (error) {
      if (error instanceof mongoose.Error.VersionError) {
        throw new ConflictException(
          'The itinerary was changed by another request. Please retry.',
        );
      }
      throw error;
    }
    return toDayResponse(day);
  }

  async deleteDay(
    itineraryId: string | Types.ObjectId,
    dayId: string | Types.ObjectId,
    userId: string,
  ): Promise<void> {
    const itinerary = await this.findOwnedOrThrow(itineraryId, userId);
    const day = isValidObjectId(dayId) ? itinerary.days.id(dayId) : null;
    if (!day) throw dayNotFound();

    itinerary.days.pull(day._id);
    itinerary.transportCosts.pull({ dayId: day._id });
    renumberDays(itinerary.days, itinerary.startDate);
    try {
      await itinerary.save();
    } catch (error) {
      if (error instanceof mongoose.Error.VersionError) {
        throw new ConflictException(
          'The itinerary was changed by another request. Please retry.',
        );
      }
      throw error;
    }
  }

  // ITN-08: moves one day to a new position (1-based). The day is moved as a whole, so everything
  // stored on it (activities, images, budget entries once they exist) moves with it. Numbers,
  // dates and city groups are then rebuilt by the shared helpers, like every other day change.
  async reorderDays(
    itineraryId: string | Types.ObjectId,
    userId: string,
    dto: ReorderDaysDto,
  ): Promise<ItineraryResponse> {
    const itinerary = await this.findOwnedOrThrow(itineraryId, userId);
    const from = isValidObjectId(dto.dayId)
      ? itinerary.days.findIndex((day) => day._id.equals(dto.dayId))
      : -1;
    if (from === -1) throw dayNotFound();

    const dayCount = itinerary.days.length;
    if (
      !Number.isInteger(dto.position) ||
      dto.position < 1 ||
      dto.position > dayCount
    ) {
      throw new BadRequestException(
        'The position is outside 1 to the number of days.',
      );
    }

    const to = dto.position - 1;
    // Same position: nothing to change, so nothing is saved (updatedAt stays as it was).
    if (from === to) return this.toResponse(itinerary);

    const ordered = itinerary.days.map((day) => day.toObject<ItineraryDay>());
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    itinerary.set('days', ordered);

    renumberDays(itinerary.days, itinerary.startDate);
    try {
      await itinerary.save();
    } catch (error) {
      if (error instanceof mongoose.Error.VersionError) {
        throw new ConflictException(
          'The itinerary was changed by another request. Please retry.',
        );
      }
      throw error;
    }
    return this.toResponse(itinerary);
  }

  async list(
    userId: string,
    page = 1,
  ): Promise<PaginatedList<ItinerarySummary>> {
    const filter = { userId: new Types.ObjectId(userId) };
    const { skip, limit } = getPaginationOffset(page, DEFAULT_PAGE_SIZE);
    const [itineraries, total] = await Promise.all([
      this.itineraryModel
        .find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.itineraryModel.countDocuments(filter).exec(),
    ]);

    if (total === 0) return emptyPaginatedList(page, DEFAULT_PAGE_SIZE);

    return paginate(
      itineraries.map((itinerary) => this.toSummary(itinerary)),
      total,
      page,
      DEFAULT_PAGE_SIZE,
    );
  }

  async getOne(
    itineraryId: string | Types.ObjectId,
    userId: string,
  ): Promise<ItineraryResponse> {
    return this.toResponse(await this.findOwnedOrThrow(itineraryId, userId));
  }

  async addActivity(
    itineraryId: string | Types.ObjectId,
    dayId: string | Types.ObjectId,
    userId: string,
    dto: CreateActivityDto,
  ): Promise<ActivityResponse> {
    const itinerary = await this.findOwnedOrThrow(itineraryId, userId);
    const day = itinerary.days.id(dayId);
    if (!day) throw dayNotFound();
    assertActivityCostCurrency(dto.cost, dto.currency);

    const activity = {
      _id: new Types.ObjectId(),
      name: dto.name,
      description: dto.description,
      time: dto.time,
      cost: dto.cost,
      currency: dto.currency,
    };
    day.activities.push(activity);
    await this.saveItinerary(itinerary);
    return toActivityResponse(activity);
  }

  async updateActivity(
    activityId: string | Types.ObjectId,
    userId: string,
    dto: UpdateActivityDto,
  ): Promise<ActivityResponse> {
    const itinerary = await this.findItineraryByOwnedActivity(
      activityId,
      userId,
    );
    const activity = this.findActivity(itinerary, activityId);
    if (!activity) throw activityNotFound();

    const cost = dto.cost !== undefined ? dto.cost : activity.cost;
    const currency = dto.currency ?? activity.currency;
    assertActivityCostCurrency(cost, currency);

    if (dto.name !== undefined) activity.name = dto.name;
    if (dto.description !== undefined) activity.description = dto.description;
    if (dto.time !== undefined) activity.time = dto.time;
    if (dto.cost !== undefined) activity.cost = dto.cost;
    if (dto.currency !== undefined) activity.currency = dto.currency;

    await this.saveItinerary(itinerary);
    return toActivityResponse(activity);
  }

  async deleteActivity(
    activityId: string | Types.ObjectId,
    userId: string,
  ): Promise<void> {
    const itinerary = await this.findItineraryByOwnedActivity(
      activityId,
      userId,
    );
    const activity = this.findActivity(itinerary, activityId);
    if (!activity) throw activityNotFound();

    const day = itinerary.days.find((candidate) =>
      candidate.activities.id(activityId),
    );
    if (!day) throw activityNotFound();
    day.activities.pull(activity._id);
    await this.saveItinerary(itinerary);
  }

  async addTransportCost(
    itineraryId: string | Types.ObjectId,
    userId: string,
    dto: CreateTransportCostDto,
  ): Promise<TransportCostResponse> {
    const itinerary = await this.findOwnedOrThrow(itineraryId, userId);
    this.assertDayBelongsToItinerary(itinerary, dto.dayId);
    await this.assertCitiesExist(dto.fromCityId, dto.toCityId);
    await this.assertCurrencyExists(dto.currency);

    const cost = {
      _id: new Types.ObjectId(),
      dayId: new Types.ObjectId(dto.dayId),
      mode: dto.mode,
      fromCityId: dto.fromCityId,
      toCityId: dto.toCityId,
      amount: dto.amount,
      currency: dto.currency,
    };
    itinerary.transportCosts.push(cost);
    await this.saveItinerary(itinerary);
    return toTransportCostResponse(cost);
  }

  async updateTransportCost(
    costId: string | Types.ObjectId,
    userId: string,
    dto: UpdateTransportCostDto,
  ): Promise<TransportCostResponse> {
    const itinerary = await this.findItineraryByOwnedTransportCost(
      costId,
      userId,
    );
    const cost = itinerary.transportCosts.id(costId);
    if (!cost) throw transportCostNotFound();
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException(
        'At least one transport cost field is required.',
      );
    }

    if (dto.dayId !== undefined) {
      this.assertDayBelongsToItinerary(itinerary, dto.dayId);
      cost.dayId = new Types.ObjectId(dto.dayId);
    }
    if (dto.fromCityId !== undefined || dto.toCityId !== undefined) {
      await this.assertCitiesExist(
        dto.fromCityId ?? cost.fromCityId,
        dto.toCityId ?? cost.toCityId,
      );
    }
    if (dto.currency !== undefined)
      await this.assertCurrencyExists(dto.currency);
    if (dto.mode !== undefined) cost.mode = dto.mode;
    if (dto.fromCityId !== undefined) cost.fromCityId = dto.fromCityId;
    if (dto.toCityId !== undefined) cost.toCityId = dto.toCityId;
    if (dto.amount !== undefined) cost.amount = dto.amount;
    if (dto.currency !== undefined) cost.currency = dto.currency;

    await this.saveItinerary(itinerary);
    return toTransportCostResponse(cost);
  }

  async deleteTransportCost(
    costId: string | Types.ObjectId,
    userId: string,
  ): Promise<void> {
    const itinerary = await this.findItineraryByOwnedTransportCost(
      costId,
      userId,
    );
    const cost = itinerary.transportCosts.id(costId);
    if (!cost) throw transportCostNotFound();
    itinerary.transportCosts.pull(cost._id);
    await this.saveItinerary(itinerary);
  }

  async remove(itineraryId: string, userId: string): Promise<void> {
    if (!isValidObjectId(itineraryId)) throw itineraryNotFound();
    const result = await this.itineraryModel
      .deleteOne({ _id: itineraryId, userId: new Types.ObjectId(userId) })
      .exec();
    if (result.deletedCount !== 1) throw itineraryNotFound();
  }

  private async findOwnedOrThrow(
    itineraryId: string | Types.ObjectId,
    userId: string,
  ): Promise<ItineraryDocument> {
    if (!isValidObjectId(itineraryId)) throw invalidItineraryId();
    const itinerary = await this.itineraryModel
      .findOne({ _id: itineraryId, userId: new Types.ObjectId(userId) })
      .exec();
    if (!itinerary) throw itineraryNotFound();
    return itinerary;
  }

  // NEW-05: every submitted country must be present in the predefined country data.
  private async assertCountriesExist(countryCodes: string[]): Promise<void> {
    const count = await this.connection
      .collection<{ _id: string }>('countries')
      .countDocuments({ _id: { $in: countryCodes } });
    if (count !== countryCodes.length) {
      throw new BadRequestException(
        'One or more countryCodes are not in the list.',
      );
    }
  }

  // ITN-05 / NEW-05: the city must be in the seeded cities collection ({ _id: cityId }). Read
  // directly, as for countries above, so this module does not depend on the reference-data module.
  private async assertCityExists(cityId: string): Promise<void> {
    const count = await this.connection
      .collection<{ _id: string }>('cities')
      .countDocuments({ _id: cityId }, { limit: 1 });
    if (count !== 1) {
      throw new BadRequestException(
        `cityId '${cityId}' is not in the list of cities.`,
      );
    }
  }

  private toResponse(itinerary: ItineraryDocument): ItineraryResponse {
    return {
      id: itinerary._id.toString(),
      title: itinerary.title,
      countryCodes: itinerary.countryCodes,
      startDate: itinerary.startDate.toISOString().slice(0, 10),
      visibility: itinerary.visibility,
      days: itinerary.days.map((day) => toDayResponse(day, true)),
      transportCosts: itinerary.transportCosts.map(toTransportCostResponse),
      // ITN-09: rebuilt from the days on every response, so it is always current after an add,
      // edit, delete or reorder that went through renumberDays.
      cityGroups: computeCityGroups(itinerary.days),
      createdAt: itinerary.createdAt,
      updatedAt: itinerary.updatedAt,
    };
  }

  private async findItineraryByOwnedTransportCost(
    costId: string | Types.ObjectId,
    userId: string,
  ): Promise<ItineraryDocument> {
    if (!isValidObjectId(costId)) throw transportCostNotFound();
    const itinerary = await this.itineraryModel
      .findOne({
        userId: new Types.ObjectId(userId),
        'transportCosts._id': costId,
      })
      .exec();
    if (!itinerary) throw transportCostNotFound();
    return itinerary;
  }

  private async findItineraryByOwnedActivity(
    activityId: string | Types.ObjectId,
    userId: string,
  ): Promise<ItineraryDocument> {
    if (!isValidObjectId(activityId)) throw activityNotFound();
    const itinerary = await this.itineraryModel
      .findOne({
        userId: new Types.ObjectId(userId),
        'days.activities._id': activityId,
      })
      .exec();
    if (!itinerary) throw activityNotFound();
    return itinerary;
  }

  private findActivity(
    itinerary: ItineraryDocument,
    activityId: string | Types.ObjectId,
  ): Activity | null {
    for (const day of itinerary.days) {
      const activity = day.activities.id(activityId);
      if (activity) return activity;
    }
    return null;
  }

  private assertDayBelongsToItinerary(
    itinerary: ItineraryDocument,
    dayId: string,
  ): void {
    if (!isValidObjectId(dayId) || !itinerary.days.id(dayId)) {
      throw new BadRequestException('The day must belong to this itinerary.');
    }
  }

  private async assertCitiesExist(
    fromCityId: string,
    toCityId: string,
  ): Promise<void> {
    const cityIds = [...new Set([fromCityId, toCityId])];
    const cities = await this.connection
      .collection<{ _id: string }>('cities')
      .countDocuments({ _id: { $in: cityIds } });
    if (cities !== cityIds.length) {
      throw new BadRequestException(
        'Both transport cities must be in the list of cities.',
      );
    }
  }

  private async assertCurrencyExists(currency: string): Promise<void> {
    const found = await this.connection
      .collection<{ _id: string }>('currencies')
      .findOne({ _id: currency }, { projection: { _id: 1 } });
    if (!found) {
      throw new BadRequestException(`Currency '${currency}' is not supported.`);
    }
  }

  private async saveItinerary(itinerary: ItineraryDocument): Promise<void> {
    try {
      await itinerary.save();
    } catch (error) {
      if (error instanceof mongoose.Error.VersionError) {
        throw new ConflictException(
          'The itinerary was changed by another request. Please retry.',
        );
      }
      throw error;
    }
  }

  private toSummary(itinerary: ItineraryDocument): ItinerarySummary {
    return {
      id: String(itinerary.id),
      title: itinerary.title,
      countryCodes: itinerary.countryCodes,
      startDate: itinerary.startDate.toISOString().slice(0, 10),
      numberOfDays: itinerary.days.length,
      visibility: itinerary.visibility,
    };
  }
}

// ITN-05: the public shape of a day. Keep these fields stable (Area 6 and the frontend use them);
// later issues add activities (ITN-10) and budget entries (ITN-14) alongside.
export interface DayResponse {
  id: string;
  number: number;
  date: string;
  cityId: string;
  notes: string;
  activities?: ActivityResponse[];
}

export interface ActivityResponse {
  id: string;
  name: string;
  description: string;
  time?: string;
  cost?: number;
  currency?: string;
}

export interface ItineraryResponse {
  id: string;
  title: string;
  countryCodes: string[];
  startDate: string;
  visibility: 'private' | 'public';
  days: DayResponse[];
  // ITN-09: consecutive days in the same city, in day order.
  cityGroups: CityGroup[];
  transportCosts: TransportCostResponse[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TransportCostResponse {
  id: string;
  dayId: string;
  mode: TransportCost['mode'];
  fromCityId: string;
  toCityId: string;
  amount: number;
  currency: string;
}

export interface ItinerarySummary {
  id: string;
  title: string;
  countryCodes: string[];
  startDate: string;
  numberOfDays: number;
  visibility: 'private' | 'public';
}

function toStartDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDayResponse(
  day: Pick<ItineraryDay, 'number' | 'date' | 'cityId' | 'notes' | '_id'> & {
    activities?: Activity[];
  },
  includeActivities = false,
): DayResponse {
  const response: DayResponse = {
    id: String(day._id),
    number: day.number,
    date: day.date.toISOString().slice(0, 10),
    cityId: day.cityId,
    notes: day.notes ?? '',
  };
  if (includeActivities) {
    response.activities = (day.activities ?? []).map(toActivityResponse);
  }
  return response;
}

function dayNotFound(): NotFoundException {
  return new NotFoundException(
    'Itinerary or day not found, or the itinerary belongs to another user.',
  );
}

function itineraryNotFound(): NotFoundException {
  return new NotFoundException(
    'Itinerary not found, or it belongs to another user.',
  );
}

function invalidItineraryId(): BadRequestException {
  return new BadRequestException('Invalid itinerary id.');
}

function transportCostNotFound(): NotFoundException {
  return new NotFoundException(
    "Transport cost not found, or it belongs to another user's itinerary.",
  );
}

function activityNotFound(): NotFoundException {
  return new NotFoundException(
    "Activity not found, or it belongs to another user's itinerary.",
  );
}

function assertActivityCostCurrency(
  cost: number | undefined,
  currency: string | undefined,
): void {
  if (cost !== undefined && currency === undefined) {
    throw new BadRequestException('currency is required when cost is given.');
  }
}

function toActivityResponse(activity: Activity): ActivityResponse {
  return {
    id: String(activity._id),
    name: activity.name,
    description: activity.description,
    ...(activity.time !== undefined ? { time: activity.time } : {}),
    ...(activity.cost !== undefined ? { cost: activity.cost } : {}),
    ...(activity.currency !== undefined ? { currency: activity.currency } : {}),
  };
}

function toTransportCostResponse(cost: TransportCost): TransportCostResponse {
  return {
    id: String(cost._id),
    dayId: String(cost.dayId),
    mode: cost.mode,
    fromCityId: cost.fromCityId,
    toCityId: cost.toCityId,
    amount: cost.amount,
    currency: cost.currency,
  };
}
