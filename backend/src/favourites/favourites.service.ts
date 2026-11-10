import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { DEFAULT_PAGE_SIZE, paginate, PaginatedList } from '../common/dto';
import { HotelsService } from '../hotels/hotels.service';
import { ItinerariesService } from '../itineraries/itineraries.service';
import { isDuplicateKeyError } from '../payments/is-duplicate-key-error';
import { AddFavouriteDto } from './dto/add-favourite.dto';
import { ListFavouritesQueryDto } from './dto/list-favourites-query.dto';
import {
  Favourite,
  FavouriteDocument,
  FavouriteType,
} from './schemas/favourite.schema';

export interface FavouriteResponse {
  id: string;
  type: FavouriteType;
  targetId: string;
  item: FavouriteItemSummary;
}

export type FavouriteItemSummary =
  | {
      id: string;
      name: string;
      cityId: string;
      countryCode: string;
      starRating: number;
      photo: string | null;
      averageRating: number;
      ratingCount: number;
    }
  | {
      id: string;
      title: string;
      countryCodes: string[];
      startDate: string;
      numberOfDays: number;
      visibility: 'public' | 'private';
    };

// BONUS (optional): implement only after all mandatory requirements are done (PDF section 12).
// Area: Hotels & Rooms (bonus)
// Business logic and database access for: BON-02
@Injectable()
export class FavouritesService {
  constructor(
    @InjectModel(Favourite.name)
    private readonly favouriteModel: Model<Favourite>,
    private readonly hotelsService: HotelsService,
    private readonly itinerariesService: ItinerariesService,
  ) {}

  async add(userId: string, dto: AddFavouriteDto): Promise<FavouriteResponse> {
    const targetId = this.parseTargetId(dto.targetId);
    await this.requireTarget(dto.type, targetId);

    let favourite: FavouriteDocument | null;
    try {
      favourite = await this.favouriteModel
        .findOneAndUpdate(
          { userId: new Types.ObjectId(userId), type: dto.type, targetId },
          {
            $setOnInsert: {
              userId: new Types.ObjectId(userId),
              type: dto.type,
              targetId,
            },
          },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        )
        .exec();
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      favourite = await this.favouriteModel
        .findOne({ userId, type: dto.type, targetId })
        .exec();
    }
    if (!favourite) throw new ConflictFavouriteException();

    const item = await this.summary(dto.type, targetId);
    if (!item) throw new NotFoundException('Favourite target not found.');
    return this.toResponse(favourite, item);
  }

  async list(
    userId: string,
    query: ListFavouritesQueryDto,
  ): Promise<PaginatedList<FavouriteResponse>> {
    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };
    if (query.type) filter.type = query.type;

    const page = query.page ?? 1;
    const favourites = await this.favouriteModel
      .find(filter)
      .sort({ createdAt: -1 })
      .exec();

    const items = await Promise.all(
      favourites.map(async (favourite) => {
        const item = await this.summary(favourite.type, favourite.targetId);
        return item ? this.toResponse(favourite, item) : null;
      }),
    );
    const visibleItems = items.filter(
      (item): item is FavouriteResponse => item !== null,
    );
    const start = (page - 1) * DEFAULT_PAGE_SIZE;
    return paginate(
      visibleItems.slice(start, start + DEFAULT_PAGE_SIZE),
      visibleItems.length,
      page,
      DEFAULT_PAGE_SIZE,
    );
  }

  async remove(userId: string, favouriteId: string): Promise<void> {
    if (!isValidObjectId(favouriteId)) {
      throw new NotFoundException('Favourite not found.');
    }
    const deleted = await this.favouriteModel.findOneAndDelete({
      _id: favouriteId,
      userId: new Types.ObjectId(userId),
    });
    if (!deleted) throw new NotFoundException('Favourite not found.');
  }

  private parseTargetId(targetId: string): Types.ObjectId {
    if (!isValidObjectId(targetId)) {
      throw new BadRequestException('targetId must be a valid ObjectId.');
    }
    return new Types.ObjectId(targetId);
  }

  private async requireTarget(
    type: FavouriteType,
    targetId: Types.ObjectId,
  ): Promise<void> {
    if (!(await this.summary(type, targetId))) {
      throw new NotFoundException(
        type === FavouriteType.Hotel
          ? 'Hotel not found.'
          : 'Itinerary not found, private or hidden.',
      );
    }
  }

  private summary(
    type: FavouriteType,
    targetId: Types.ObjectId,
  ): Promise<FavouriteItemSummary | null> {
    return type === FavouriteType.Hotel
      ? this.hotelsService.findFavouriteSummary(targetId)
      : this.itinerariesService.findPublicFavouriteSummary(targetId);
  }

  private toResponse(
    favourite: FavouriteDocument,
    item: FavouriteItemSummary,
  ): FavouriteResponse {
    return {
      id: favourite.id as string,
      type: favourite.type,
      targetId: favourite.targetId.toString(),
      item,
    };
  }
}

class ConflictFavouriteException extends ConflictException {
  constructor() {
    super('The favourite could not be created. Please try again.');
  }
}
