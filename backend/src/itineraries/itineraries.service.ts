import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { Connection, isValidObjectId, Model, Types } from 'mongoose';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
import { Itinerary, ItineraryDocument } from './schemas/itinerary.schema';

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

  async remove(itineraryId: string, userId: string): Promise<void> {
    if (!isValidObjectId(itineraryId)) throw itineraryNotFound();
    const result = await this.itineraryModel
      .deleteOne({ _id: itineraryId, userId: new Types.ObjectId(userId) })
      .exec();
    if (result.deletedCount !== 1) throw itineraryNotFound();
  }

  private async findOwnedOrThrow(
    itineraryId: string,
    userId: string,
  ): Promise<ItineraryDocument> {
    if (!isValidObjectId(itineraryId)) throw itineraryNotFound();
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

  private toResponse(itinerary: ItineraryDocument): ItineraryResponse {
    return {
      id: itinerary.id,
      title: itinerary.title,
      countryCodes: itinerary.countryCodes,
      startDate: itinerary.startDate.toISOString().slice(0, 10),
      visibility: itinerary.visibility,
      createdAt: itinerary.createdAt,
      updatedAt: itinerary.updatedAt,
    };
  }
}

export interface ItineraryResponse {
  id: string;
  title: string;
  countryCodes: string[];
  startDate: string;
  visibility: 'private' | 'public';
  createdAt?: Date;
  updatedAt?: Date;
}

function toStartDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function itineraryNotFound(): NotFoundException {
  return new NotFoundException(
    'Itinerary not found, or it belongs to another user.',
  );
}
