import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DEFAULT_PAGE_SIZE,
  getPaginationOffset,
  paginate,
  PaginatedList,
  PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { Currency, CurrencyDocument } from './schemas/reference-data.schema';

// One item of GET /api/currencies.
export interface CurrencyItem {
  code: string;
  name: string;
}

// Area: Reference Data & Seeding
// Business logic and database access for: FLT-02, GEN-12, NEW-05
//
// All reference data is read-only: it is loaded by the seed script (npm run seed) and never
// changed through the API.
@Injectable()
export class ReferenceDataService {
  constructor(
    @InjectModel(Currency.name)
    private readonly currencyModel: Model<CurrencyDocument>,
  ) {}

  // GEN-12: the supported currency list, sorted by code, 10 per page (GEN-05).
  // No currencies (database not seeded yet) is an empty page, not an error (GEN-04).
  async listCurrencies(
    query: PaginationQueryDto,
  ): Promise<PaginatedList<CurrencyItem>> {
    const page = query.page ?? 1;
    const { skip, limit } = getPaginationOffset(page, DEFAULT_PAGE_SIZE);

    const [currencies, total] = await Promise.all([
      this.currencyModel
        .find()
        .sort({ _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.currencyModel.countDocuments().exec(),
    ]);

    const items = currencies.map((c) => ({ code: c.code, name: c.name }));
    return paginate(items, total, page, DEFAULT_PAGE_SIZE);
  }

  // GEN-12 lookup for other modules: whether a currency code is in the supported list.
  async isSupportedCurrency(code: string): Promise<boolean> {
    if (typeof code !== 'string' || code.trim() === '') return false;
    const found = await this.currencyModel
      .exists({ _id: code.trim().toUpperCase() })
      .exec();
    return found !== null;
  }

  // GEN-12 lookup for other modules: throws 400 when the currency is not supported.
  async assertSupportedCurrency(code: string): Promise<void> {
    if (!(await this.isSupportedCurrency(code))) {
      throw new BadRequestException(
        `Currency "${code}" is not in the supported currency list.`,
      );
    }
  }
}
