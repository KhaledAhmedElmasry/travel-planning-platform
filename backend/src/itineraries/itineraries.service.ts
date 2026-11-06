import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
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
import { CreateBudgetEntryDto } from './dto/create-budget-entry.dto';
import { UpdateBudgetEntryDto } from './dto/update-budget-entry.dto';
import { SearchPublicItinerariesQueryDto } from './dto/search-public-itineraries-query.dto';
import { UploadsService } from '../uploads/uploads.service';
import {
  Itinerary,
  ItineraryDay,
  ItineraryDocument,
  Activity,
  TransportCost,
  BudgetCategory,
  BudgetEntry,
} from './schemas/itinerary.schema';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { UsersService } from '../users/users.service';
import { AccountStatus } from '../common/enums';

// Area: Itineraries
// Business logic and database access for: ITN-01..ITN-26
@Injectable()
export class ItinerariesService {
  constructor(
    @InjectModel(Itinerary.name)
    private readonly itineraryModel: Model<Itinerary>,
    @InjectConnection() private readonly connection: Connection,
    @Optional() private readonly uploadsService?: UploadsService,
    @Optional() private readonly usersService?: UsersService,
    @Optional() private readonly exchangeRatesService?: ExchangeRatesService,
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
    if (dto.visibility !== undefined) {
      assertVisibility(dto.visibility);
      itinerary.visibility = dto.visibility;
    }
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
    await this.removeImages(
      (day.activities ?? []).flatMap((activity) =>
        (activity.images ?? []).map((image) => image.storageKey),
      ),
    );

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

  async searchPublic(
    query: SearchPublicItinerariesQueryDto = {},
  ): Promise<PaginatedList<ItinerarySummary>> {
    if (
      query.minDays !== undefined &&
      query.maxDays !== undefined &&
      query.minDays > query.maxDays
    ) {
      throw new BadRequestException('minDays cannot be greater than maxDays.');
    }

    // ACC-12: public itineraries of deactivated accounts are hidden.
    const filter: Record<string, unknown> = {
      visibility: 'public',
      hidden: { $ne: true },
      userId: { $nin: await this.deactivatedUserIds() },
    };
    const andFilters: Record<string, unknown>[] = [];
    const keyword = query.keyword?.trim();
    if (keyword) {
      const regex = escapedRegex(keyword);
      const [countryCodes, cityIds] = await Promise.all([
        this.findReferenceIds('countries', regex, ['name', '_id']),
        this.findReferenceIds('cities', regex, ['name', '_id']),
      ]);
      andFilters.push({
        $or: [
          { title: { $regex: regex, $options: 'i' } },
          { countryCodes: { $in: countryCodes } },
          { 'days.cityId': { $in: cityIds } },
        ],
      });
    }
    if (query.country?.trim()) {
      const countryCodes = await this.findReferenceIds(
        'countries',
        escapedRegex(query.country.trim()),
        ['name', '_id'],
      );
      andFilters.push({ countryCodes: { $in: countryCodes } });
    }
    if (query.city?.trim()) {
      const cityIds = await this.findReferenceIds(
        'cities',
        escapedRegex(query.city.trim()),
        ['name', '_id'],
      );
      andFilters.push({ 'days.cityId': { $in: cityIds } });
    }
    if (query.minDays !== undefined || query.maxDays !== undefined) {
      const size: Record<string, unknown> = { $size: '$days' };
      andFilters.push({
        $expr: {
          $and: [
            { $gte: [size, query.minDays ?? 0] },
            { $lte: [size, query.maxDays ?? Number.MAX_SAFE_INTEGER] },
          ],
        },
      });
    }
    if (andFilters.length > 0) filter.$and = andFilters;

    const page = query.page ?? 1;
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

  async getPublic(
    itineraryId: string | Types.ObjectId,
    currency?: string,
  ): Promise<PublicItineraryResponse> {
    if (!isValidObjectId(itineraryId)) throw publicItineraryNotFound();
    if (currency !== undefined) await this.assertCurrencyExists(currency);
    const itinerary = await this.itineraryModel
      .findOne({
        _id: itineraryId,
        visibility: 'public',
        hidden: { $ne: true },
      })
      .exec();
    if (!itinerary) throw publicItineraryNotFound();
    const author = this.usersService
      ? await this.usersService.findById(String(itinerary.userId))
      : null;
    if (!author || author.status === AccountStatus.Deactivated) {
      throw publicItineraryNotFound(); // ACC-12
    }
    return {
      ...this.toResponse(itinerary),
      author: { id: String(author._id), name: author.name },
      originalAuthor: itinerary.originalAuthorId
        ? await this.publicAuthor(itinerary.originalAuthorId)
        : null,
      budget: await this.calculateBudgetSummary(itinerary, currency),
    };
  }

  async clone(
    itineraryId: string | Types.ObjectId,
    userId: string,
  ): Promise<ItineraryResponse> {
    if (!isValidObjectId(itineraryId)) throw publicItineraryNotFound();
    const source = await this.itineraryModel
      .findOne({
        _id: itineraryId,
        visibility: 'public',
        hidden: { $ne: true },
      })
      .exec();
    if (!source || (await this.isDeactivatedUser(source.userId))) {
      throw publicItineraryNotFound(); // ACC-12
    }
    const dayIds = new Map<string, Types.ObjectId>();
    const days = source.days.map((day) => {
      const id = new Types.ObjectId();
      dayIds.set(String(day._id), id);
      return {
        _id: id,
        number: day.number,
        date: new Date(day.date),
        cityId: day.cityId,
        notes: day.notes,
        activities: (day.activities ?? []).map((activity) => ({
          ...activity.toObject(),
          _id: new Types.ObjectId(),
          images: (activity.images ?? []).map((image) => ({
            ...image.toObject(),
            _id: new Types.ObjectId(),
          })),
        })),
        budgets: (day.budgets ?? []).map((budget) => ({
          ...budget.toObject(),
          _id: new Types.ObjectId(),
        })),
      };
    });
    const clone = await this.itineraryModel.create({
      userId: new Types.ObjectId(userId),
      title: source.title,
      countryCodes: [...source.countryCodes],
      startDate: new Date(source.startDate),
      visibility: 'private',
      originalItineraryId: source._id,
      originalAuthorId: source.userId,
      days,
      transportCosts: source.transportCosts.map((cost) => ({
        ...cost.toObject(),
        _id: new Types.ObjectId(),
        dayId: dayIds.get(String(cost.dayId)) ?? new Types.ObjectId(),
      })),
    });
    return this.toResponse(clone);
  }

  async getOne(
    itineraryId: string | Types.ObjectId,
    userId: string,
  ): Promise<ItineraryResponse> {
    return this.toResponse(await this.findOwnedOrThrow(itineraryId, userId));
  }

  async addBudgetEntry(
    itineraryId: string | Types.ObjectId,
    dayId: string | Types.ObjectId,
    userId: string,
    dto: CreateBudgetEntryDto,
  ): Promise<BudgetEntryResponse> {
    const itinerary = await this.findOwnedOrThrow(itineraryId, userId);
    const day = isValidObjectId(dayId) ? itinerary.days.id(dayId) : null;
    if (!day) throw dayNotFound();
    await this.assertCurrencyExists(dto.currency);

    const entry = {
      _id: new Types.ObjectId(),
      category: dto.category,
      amount: dto.amount,
      currency: dto.currency,
      description: dto.description ?? '',
    };
    day.budgets.push(entry);
    await this.saveItinerary(itinerary);
    return toBudgetEntryResponse(entry, day._id);
  }

  async updateBudgetEntry(
    budgetId: string | Types.ObjectId,
    userId: string,
    dto: UpdateBudgetEntryDto,
  ): Promise<BudgetEntryResponse> {
    const itinerary = await this.findItineraryByOwnedBudgetEntry(
      budgetId,
      userId,
    );
    const found = this.findBudgetEntry(itinerary, budgetId);
    if (!found) throw budgetEntryNotFound();
    const { entry, day } = found;
    if (dto.currency !== undefined)
      await this.assertCurrencyExists(dto.currency);
    if (dto.category !== undefined) entry.category = dto.category;
    if (dto.amount !== undefined) entry.amount = dto.amount;
    if (dto.currency !== undefined) entry.currency = dto.currency;
    if (dto.description !== undefined) entry.description = dto.description;
    await this.saveItinerary(itinerary);
    return toBudgetEntryResponse(entry, day._id);
  }

  async deleteBudgetEntry(
    budgetId: string | Types.ObjectId,
    userId: string,
  ): Promise<void> {
    const itinerary = await this.findItineraryByOwnedBudgetEntry(
      budgetId,
      userId,
    );
    const found = this.findBudgetEntry(itinerary, budgetId);
    if (!found) throw budgetEntryNotFound();
    found.day.budgets.pull(found.entry._id);
    await this.saveItinerary(itinerary);
  }

  async getBudgetSummary(
    itineraryId: string | Types.ObjectId,
    userId: string,
    currency?: string,
  ): Promise<BudgetSummaryResponse> {
    const itinerary = await this.findOwnedOrThrow(itineraryId, userId);
    if (currency !== undefined) await this.assertCurrencyExists(currency);

    const byCategory = emptyCategoryTotals();
    const byDay: BudgetDayTotal[] = [];
    for (const day of itinerary.days) {
      const totals = emptyTotals();
      for (const budget of day.budgets ?? []) {
        addAmount(byCategory[budget.category], budget.currency, budget.amount);
        addAmount(totals, budget.currency, budget.amount);
      }
      for (const activity of day.activities ?? []) {
        if (activity.cost !== undefined && activity.currency !== undefined) {
          addAmount(byCategory.activities, activity.currency, activity.cost);
          addAmount(totals, activity.currency, activity.cost);
        }
      }
      for (const cost of itinerary.transportCosts.filter((item) =>
        item.dayId.equals(day._id),
      )) {
        addAmount(totals, cost.currency, cost.amount);
      }
      byDay.push({
        dayId: String(day._id),
        dayNumber: day.number,
        date: day.date.toISOString().slice(0, 10),
        totals,
      });
    }

    const intercityTransport = emptyTotals();
    for (const cost of itinerary.transportCosts) {
      addAmount(intercityTransport, cost.currency, cost.amount);
    }
    const grandTotal = sumTotals(
      Object.values(byCategory).concat(intercityTransport),
    );
    const targetCurrency =
      currency ??
      (this.usersService
        ? (await this.usersService.findById(userId))?.preferredCurrency
        : undefined);

    if (targetCurrency && this.exchangeRatesService) {
      await this.assertCurrencyExists(targetCurrency);
      const convertedCategories: Record<BudgetCategory, CurrencyTotals> =
        {} as Record<BudgetCategory, CurrencyTotals>;
      for (const category of Object.values(BudgetCategory)) {
        convertedCategories[category] = (
          await this.exchangeRatesService.convertTotals(
            byCategory[category],
            targetCurrency,
          )
        ).totals;
      }
      const convertedDays: BudgetDayTotal[] = [];
      let rateDate: string | undefined;
      for (const dayTotal of byDay) {
        const converted = await this.exchangeRatesService.convertTotals(
          dayTotal.totals,
          targetCurrency,
        );
        rateDate ??= converted.rateDate;
        convertedDays.push({ ...dayTotal, totals: converted.totals });
      }
      const convertedTransport = await this.exchangeRatesService.convertTotals(
        intercityTransport,
        targetCurrency,
      );
      const convertedGrandTotal = await this.exchangeRatesService.convertTotals(
        grandTotal,
        targetCurrency,
      );
      rateDate ??= convertedTransport.rateDate;
      rateDate ??= convertedGrandTotal.rateDate;

      return {
        totalsByCategory: byCategory,
        totalsByDay: byDay,
        intercityTransport,
        grandTotal,
        convertedTotal: {
          currency: targetCurrency,
          rateDate: rateDate,
          totalsByCategory: convertedCategories,
          totalsByDay: convertedDays,
          intercityTransport: convertedTransport.totals,
          grandTotal: convertedGrandTotal.totals,
        },
      };
    }

    return {
      totalsByCategory: byCategory,
      totalsByDay: byDay,
      intercityTransport,
      grandTotal,
      convertedTotal: null,
    };
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
    if (dto.currency !== undefined)
      await this.assertCurrencyExists(dto.currency);

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
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('At least one activity field is required.');
    }

    const cost = dto.cost !== undefined ? dto.cost : activity.cost;
    const currency = dto.currency ?? activity.currency;
    assertActivityCostCurrency(cost, currency);
    if (dto.currency !== undefined)
      await this.assertCurrencyExists(dto.currency);

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
    await this.removeImages(
      (activity.images ?? []).map((image) => image.storageKey),
    );
    day.activities.pull(activity._id);
    await this.saveItinerary(itinerary);
  }

  async attachActivityImage(
    activityId: string | Types.ObjectId,
    userId: string,
    file: Express.Multer.File,
  ): Promise<ActivityImageResponse> {
    const itinerary = await this.findItineraryByOwnedActivity(
      activityId,
      userId,
    );
    const activity = this.findActivity(itinerary, activityId);
    if (!activity) throw activityNotFound();
    if ((activity.images ?? []).length >= 5) {
      throw new BadRequestException(
        'Not JPG/PNG, larger than 5 MB, or the activity already has 5 images.',
      );
    }
    if (!this.uploadsService) {
      throw new Error('The shared GEN-08 upload service is not configured.');
    }

    const image = await this.uploadsService.storeImage(file);
    const imageDocument = {
      _id: new Types.ObjectId(image.id),
      url: image.url,
      storageKey: image.storageKey,
    };
    activity.images!.push(imageDocument);
    try {
      await this.saveItinerary(itinerary);
    } catch (error) {
      await this.uploadsService.removeImage(image.storageKey);
      throw error;
    }
    return { id: image.id, url: image.url };
  }

  async removeActivityImage(
    activityId: string | Types.ObjectId,
    imageId: string | Types.ObjectId,
    userId: string,
  ): Promise<void> {
    const itinerary = await this.findItineraryByOwnedActivity(
      activityId,
      userId,
    );
    const activity = this.findActivity(itinerary, activityId);
    const image = activity?.images?.id(imageId);
    if (!activity || !image) throw activityNotFound();

    await this.removeImages([image.storageKey]);
    activity.images!.pull(image._id);
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
    const itinerary = await this.findOwnedOrThrow(itineraryId, userId);
    await this.removeImages(
      itinerary.days.flatMap((day) =>
        (day.activities ?? []).flatMap((activity) =>
          (activity.images ?? []).map((image) => image.storageKey),
        ),
      ),
    );
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

  private async findReferenceIds(
    collectionName: 'countries' | 'cities',
    regex: string,
    fields: string[],
  ): Promise<string[]> {
    const matches = await this.connection
      .collection<{ _id: string }>(collectionName)
      .find(
        {
          $or: fields.map((field) => ({
            [field]: { $regex: regex, $options: 'i' },
          })),
        },
        { projection: { _id: 1 } },
      )
      .toArray();
    return matches.map((match) => match._id);
  }

  // ACC-12: ids of deactivated accounts, whose public itineraries are hidden.
  private async deactivatedUserIds(): Promise<Types.ObjectId[]> {
    return this.connection
      .collection<{ _id: Types.ObjectId }>('users')
      .distinct('_id', { status: AccountStatus.Deactivated });
  }

  private async isDeactivatedUser(userId: Types.ObjectId): Promise<boolean> {
    const found = await this.connection
      .collection('users')
      .findOne(
        { _id: userId, status: AccountStatus.Deactivated },
        { projection: { _id: 1 } },
      );
    return found !== null;
  }

  private async publicAuthor(
    authorId: Types.ObjectId,
  ): Promise<{ id: string; name: string } | null> {
    const author = this.usersService
      ? await this.usersService.findById(String(authorId))
      : null;
    return author ? { id: String(author._id), name: author.name } : null;
  }

  private async calculateBudgetSummary(
    itinerary: ItineraryDocument,
    currency?: string,
  ): Promise<BudgetSummaryResponse> {
    const byCategory = emptyCategoryTotals();
    const byDay: BudgetDayTotal[] = [];
    for (const day of itinerary.days) {
      const totals = emptyTotals();
      for (const budget of day.budgets ?? []) {
        addAmount(byCategory[budget.category], budget.currency, budget.amount);
        addAmount(totals, budget.currency, budget.amount);
      }
      for (const activity of day.activities ?? []) {
        if (activity.cost !== undefined && activity.currency !== undefined) {
          addAmount(byCategory.activities, activity.currency, activity.cost);
          addAmount(totals, activity.currency, activity.cost);
        }
      }
      for (const cost of itinerary.transportCosts.filter((item) =>
        item.dayId.equals(day._id),
      )) {
        addAmount(totals, cost.currency, cost.amount);
      }
      byDay.push({
        dayId: String(day._id),
        dayNumber: day.number,
        date: day.date.toISOString().slice(0, 10),
        totals,
      });
    }
    const intercityTransport = emptyTotals();
    for (const cost of itinerary.transportCosts) {
      addAmount(intercityTransport, cost.currency, cost.amount);
    }
    const grandTotal = sumTotals(
      Object.values(byCategory).concat(intercityTransport),
    );
    if (currency && this.exchangeRatesService) {
      const convertedCategories = {} as Record<BudgetCategory, CurrencyTotals>;
      for (const category of Object.values(BudgetCategory)) {
        convertedCategories[category] = (
          await this.exchangeRatesService.convertTotals(
            byCategory[category],
            currency,
          )
        ).totals;
      }
      const convertedDays: BudgetDayTotal[] = [];
      let rateDate = '';
      for (const dayTotal of byDay) {
        const converted = await this.exchangeRatesService.convertTotals(
          dayTotal.totals,
          currency,
        );
        rateDate ||= converted.rateDate;
        convertedDays.push({ ...dayTotal, totals: converted.totals });
      }
      const convertedTransport = await this.exchangeRatesService.convertTotals(
        intercityTransport,
        currency,
      );
      const convertedGrandTotal = await this.exchangeRatesService.convertTotals(
        grandTotal,
        currency,
      );
      rateDate ||= convertedTransport.rateDate || convertedGrandTotal.rateDate;
      return {
        totalsByCategory: byCategory,
        totalsByDay: byDay,
        intercityTransport,
        grandTotal,
        convertedTotal: {
          currency,
          rateDate,
          totalsByCategory: convertedCategories,
          totalsByDay: convertedDays,
          intercityTransport: convertedTransport.totals,
          grandTotal: convertedGrandTotal.totals,
        },
      };
    }
    return {
      totalsByCategory: byCategory,
      totalsByDay: byDay,
      intercityTransport,
      grandTotal,
      convertedTotal: null,
    };
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
      ...(itinerary.originalItineraryId
        ? { originalItineraryId: String(itinerary.originalItineraryId) }
        : {}),
      ...(itinerary.originalAuthorId
        ? { originalAuthorId: String(itinerary.originalAuthorId) }
        : {}),
      // ITN-09: rebuilt from the days on every response, so it is always current after an add,
      // edit, delete or reorder that went through renumberDays.
      cityGroups: computeCityGroups(itinerary.days).map((group) => ({
        ...group,
        budgetSubtotal: this.cityGroupSubtotal(itinerary, group.dayIds),
      })),
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

  private async findItineraryByOwnedBudgetEntry(
    budgetId: string | Types.ObjectId,
    userId: string,
  ): Promise<ItineraryDocument> {
    if (!isValidObjectId(budgetId)) throw budgetEntryNotFound();
    const itinerary = await this.itineraryModel
      .findOne({
        userId: new Types.ObjectId(userId),
        'days.budgets._id': budgetId,
      })
      .exec();
    if (!itinerary) throw budgetEntryNotFound();
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

  private findBudgetEntry(
    itinerary: ItineraryDocument,
    budgetId: string | Types.ObjectId,
  ): { entry: BudgetEntry; day: ItineraryDay } | null {
    for (const day of itinerary.days) {
      const entry = day.budgets?.id(budgetId);
      if (entry) return { entry, day };
    }
    return null;
  }

  private cityGroupSubtotal(
    itinerary: ItineraryDocument,
    dayIds: string[],
  ): CurrencyTotals {
    const totals = emptyTotals();
    for (const dayId of dayIds) {
      const day = itinerary.days.id(dayId);
      if (!day) continue;
      for (const budget of day.budgets ?? []) {
        addAmount(totals, budget.currency, budget.amount);
      }
      for (const activity of day.activities ?? []) {
        if (activity.cost !== undefined && activity.currency !== undefined) {
          addAmount(totals, activity.currency, activity.cost);
        }
      }
      for (const cost of itinerary.transportCosts.filter((item) =>
        item.dayId.equals(day._id),
      )) {
        addAmount(totals, cost.currency, cost.amount);
      }
    }
    return totals;
  }

  private async removeImages(storageKeys: string[]): Promise<void> {
    if (storageKeys.length > 0 && this.uploadsService) {
      await this.uploadsService.removeImages(storageKeys);
    }
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
    if (fromCityId === toCityId) {
      throw new BadRequestException(
        'Intercity transport needs two different cities.',
      );
    }
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
  budgets?: BudgetEntryResponse[];
}

export interface ActivityResponse {
  id: string;
  name: string;
  description: string;
  time?: string;
  cost?: number;
  currency?: string;
  images?: ActivityImageResponse[];
}

export interface ActivityImageResponse {
  id: string;
  url: string;
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
  originalItineraryId?: string | null;
  originalAuthorId?: string | null;
}

export interface PublicItineraryResponse extends ItineraryResponse {
  author: { id: string; name: string };
  originalAuthor: { id: string; name: string } | null;
  budget: BudgetSummaryResponse;
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

export type CurrencyTotals = Record<string, number>;

export interface BudgetEntryResponse {
  id: string;
  dayId: string;
  category: BudgetCategory;
  amount: number;
  currency: string;
  description: string;
}

export interface BudgetDayTotal {
  dayId: string;
  dayNumber: number;
  date: string;
  totals: CurrencyTotals;
}

export interface BudgetSummaryResponse {
  totalsByCategory: Record<BudgetCategory, CurrencyTotals>;
  totalsByDay: BudgetDayTotal[];
  intercityTransport: CurrencyTotals;
  grandTotal: CurrencyTotals;
  convertedTotal: ConvertedBudgetSummary | null;
}

export interface ConvertedBudgetSummary {
  currency: string;
  rateDate: string;
  totalsByCategory: Record<BudgetCategory, CurrencyTotals>;
  totalsByDay: BudgetDayTotal[];
  intercityTransport: CurrencyTotals;
  grandTotal: CurrencyTotals;
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
    budgets?: BudgetEntry[];
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
    response.budgets = (day.budgets ?? []).map((budget) =>
      toBudgetEntryResponse(budget, day._id),
    );
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

function publicItineraryNotFound(): NotFoundException {
  return new NotFoundException('Itinerary not found, private or hidden.');
}

function escapedRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function budgetEntryNotFound(): NotFoundException {
  return new NotFoundException(
    "Budget entry not found, or it belongs to another user's itinerary.",
  );
}

function emptyTotals(): CurrencyTotals {
  return {};
}

function emptyCategoryTotals(): Record<BudgetCategory, CurrencyTotals> {
  return {
    [BudgetCategory.Food]: emptyTotals(),
    [BudgetCategory.Accommodation]: emptyTotals(),
    [BudgetCategory.InCityTransport]: emptyTotals(),
    [BudgetCategory.Activities]: emptyTotals(),
  };
}

function addAmount(
  totals: CurrencyTotals,
  currency: string,
  amount: number,
): void {
  totals[currency] = (totals[currency] ?? 0) + amount;
}

function sumTotals(totals: CurrencyTotals[]): CurrencyTotals {
  const result = emptyTotals();
  for (const totalsForCurrency of totals) {
    for (const [currency, amount] of Object.entries(totalsForCurrency)) {
      addAmount(result, currency, amount);
    }
  }
  return result;
}

function assertActivityCostCurrency(
  cost: number | undefined,
  currency: string | undefined,
): void {
  if (cost !== undefined && currency === undefined) {
    throw new BadRequestException('currency is required when cost is given.');
  }
}

function assertVisibility(
  visibility: unknown,
): asserts visibility is 'private' | 'public' {
  if (visibility !== 'private' && visibility !== 'public') {
    throw new BadRequestException(
      'Visibility must be either private or public.',
    );
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
    images: (activity.images ?? []).map((image) => ({
      id: String(image._id),
      url: image.url,
    })),
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

function toBudgetEntryResponse(
  entry: BudgetEntry,
  dayId: Types.ObjectId,
): BudgetEntryResponse {
  return {
    id: String(entry._id),
    dayId: String(dayId),
    category: entry.category,
    amount: entry.amount,
    currency: entry.currency,
    description: entry.description ?? '',
  };
}
