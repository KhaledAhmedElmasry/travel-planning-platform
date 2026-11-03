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
  dayDate,
  MAX_ITINERARY_DAYS,
  renumberDays,
} from './day-schedule';
import { CreateDayDto } from './dto/create-day.dto';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { UpdateDayDto } from './dto/update-day.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
import {
  Itinerary,
  ItineraryDay,
  ItineraryDocument,
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
      id: String(itinerary.id),
      title: itinerary.title,
      countryCodes: itinerary.countryCodes,
      startDate: itinerary.startDate.toISOString().slice(0, 10),
      visibility: itinerary.visibility,
      days: itinerary.days.map(toDayResponse),
      createdAt: itinerary.createdAt,
      updatedAt: itinerary.updatedAt,
    };
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
}

export interface ItineraryResponse {
  id: string;
  title: string;
  countryCodes: string[];
  startDate: string;
  visibility: 'private' | 'public';
  days: DayResponse[];
  createdAt?: Date;
  updatedAt?: Date;
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

function toDayResponse(day: ItineraryDay): DayResponse {
  return {
    id: String(day._id),
    number: day.number,
    date: day.date.toISOString().slice(0, 10),
    cityId: day.cityId,
    notes: day.notes ?? '',
  };
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
