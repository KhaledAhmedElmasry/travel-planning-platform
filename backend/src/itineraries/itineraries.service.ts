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
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
import {
  Itinerary,
  ItineraryDay,
  ItineraryDocument,
} from './schemas/itinerary.schema';
import { computeCityGroups, dayDate, renumberDays } from './day-schedule';

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
    if (dto.startDate !== undefined)
      itinerary.startDate = toStartDate(dto.startDate);
    if (dto.startDate !== undefined && itinerary.days?.length) {
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

  async addDay(
    itineraryId: string | Types.ObjectId,
    userId: string,
    dto: { cityId: string; notes?: string },
  ): Promise<DayResponse> {
    const itinerary = await this.findOwnedOrThrow(itineraryId, userId);
    const days = itinerary.days ?? [];
    if (days.length >= 60) {
      throw new ConflictException(
        'An itinerary cannot contain more than 60 days.',
      );
    }
    await this.assertCityExists(dto.cityId);

    const day = {
      _id: new Types.ObjectId(),
      number: days.length + 1,
      date: dayDate(itinerary.startDate, days.length + 1),
      cityId: dto.cityId,
      notes: dto.notes ?? '',
    };
    const result = await this.itineraryModel
      .updateOne(
        {
          _id: itinerary._id,
          userId: new Types.ObjectId(userId),
          days: { $size: days.length },
        },
        { $push: { days: day } },
      )
      .exec();
    if (result.matchedCount !== 1) {
      throw new ConflictException(
        'The itinerary was changed by another request. Please retry.',
      );
    }
    return this.toDayResponse(day);
  }

  async updateDay(
    itineraryId: string | Types.ObjectId,
    dayId: string | Types.ObjectId,
    userId: string,
    dto: { cityId?: string; notes?: string },
  ): Promise<DayResponse> {
    const itinerary = await this.findOwnedOrThrow(itineraryId, userId);
    const day = (itinerary.days ?? []).find(
      (candidate) => String(candidate._id) === String(dayId),
    );
    if (!day) throw new NotFoundException('Day not found in this itinerary.');
    if (dto.cityId !== undefined) {
      await this.assertCityExists(dto.cityId);
      day.cityId = dto.cityId;
    }
    if (dto.notes !== undefined) day.notes = dto.notes;
    await itinerary.save();
    return this.toDayResponse(day);
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

  private async assertCityExists(cityId: string): Promise<void> {
    const count = await this.connection
      .collection<{ _id: string }>('cities')
      .countDocuments({ _id: cityId });
    if (count !== 1) throw new BadRequestException('City is not in the list.');
  }

  private toResponse(itinerary: ItineraryDocument): ItineraryResponse {
    const days = itinerary.days ?? [];
    renumberDays(days, itinerary.startDate);
    return {
      id: String(itinerary.id),
      title: itinerary.title,
      countryCodes: itinerary.countryCodes,
      startDate: itinerary.startDate.toISOString().slice(0, 10),
      visibility: itinerary.visibility,
      // Day storage and day management are ITN-05. Before that issue, the full itinerary has no days.
      days: days.map((day) => this.toDayResponse(day)),
      cityGroups: computeCityGroups(days),
      createdAt: itinerary.createdAt,
      updatedAt: itinerary.updatedAt,
    };
  }

  private toDayResponse(
    day:
      | ItineraryDay
      | {
          _id: Types.ObjectId;
          number: number;
          date: Date;
          cityId: string;
          notes: string;
        },
  ): DayResponse {
    return {
      id: day._id.toString(),
      number: day.number,
      date: day.date.toISOString().slice(0, 10),
      cityId: day.cityId,
      notes: day.notes ?? '',
    };
  }

  private toSummary(itinerary: ItineraryDocument): ItinerarySummary {
    return {
      id: String(itinerary.id),
      title: itinerary.title,
      countryCodes: itinerary.countryCodes,
      startDate: itinerary.startDate.toISOString().slice(0, 10),
      numberOfDays: 0,
      visibility: itinerary.visibility,
    };
  }
}

export interface ItineraryResponse {
  id: string;
  title: string;
  countryCodes: string[];
  startDate: string;
  visibility: 'private' | 'public';
  days: DayResponse[];
  cityGroups: ReturnType<typeof computeCityGroups>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DayResponse {
  id: string;
  number: number;
  date: string;
  cityId: string;
  notes: string;
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

function itineraryNotFound(): NotFoundException {
  return new NotFoundException(
    'Itinerary not found, or it belongs to another user.',
  );
}

function invalidItineraryId(): BadRequestException {
  return new BadRequestException('Invalid itinerary id.');
}
