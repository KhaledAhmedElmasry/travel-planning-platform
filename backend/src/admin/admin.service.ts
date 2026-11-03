import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { AccountStatus, Role } from '../common/enums';
import {
  DEFAULT_PAGE_SIZE,
  getPaginationOffset,
  paginate,
  PaginatedList,
} from '../common/dto/pagination.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';

export interface AccountListItem {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: AccountStatus;
  registrationDate: Date;
  createdAt: Date;
  airlineId?: string;
  hotelId?: string;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Area: Auth & Accounts
// Business logic and database access for: ACC-07a, ACC-13, ACC-14, ACC-15, ACC-16, ACC-17
@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  // ACC-14: Paginated list of all accounts with search by name/email and filter by role/status
  async listAccounts(
    query: ListAccountsQueryDto,
  ): Promise<PaginatedList<AccountListItem>> {
    const filter: FilterQuery<UserDocument> = {};

    if (query.search) {
      const searchRegex = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ name: searchRegex }, { email: searchRegex }];
    }

    if (query.role) {
      filter.role = query.role;
    }

    if (query.status) {
      filter.status = query.status;
    }

    const page = query.page ?? 1;
    const { skip, limit } = getPaginationOffset(page, DEFAULT_PAGE_SIZE);

    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    const items: AccountListItem[] = users.map((user) => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      registrationDate: user.createdAt ?? new Date(),
      createdAt: user.createdAt ?? new Date(),
      airlineId: user.airlineId ? user.airlineId.toString() : undefined,
      hotelId: user.hotelId ? user.hotelId.toString() : undefined,
    }));

    return paginate(items, total, page, DEFAULT_PAGE_SIZE);
  }
}
