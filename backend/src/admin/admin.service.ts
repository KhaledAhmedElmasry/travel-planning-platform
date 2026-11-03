import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, FilterQuery, Model, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { SessionsService } from '../auth/sessions.service';
import { AccountStatus, Role } from '../common/enums';
import {
  DEFAULT_PAGE_SIZE,
  getPaginationOffset,
  paginate,
  PaginatedList,
} from '../common/dto/pagination.dto';
import type { AuthUser } from '../common/interfaces';
import { NotificationsService } from '../notifications/notifications.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AdminActionDto } from './dto/admin-action.dto';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';

export interface AccountResponse {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: AccountStatus;
  airlineId?: string;
  hotelId?: string;
  mustChangePassword: boolean;
}

export interface ProviderActionResponse {
  id: string;
  active: boolean;
  message: string;
}

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
    @InjectConnection() private readonly connection: Connection,
    private readonly sessionsService: SessionsService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
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

  // ACC-15, ACC-16: Suspend a user or moderator account
  async suspendAccount(
    admin: AuthUser,
    id: string,
    dto?: AdminActionDto,
  ): Promise<AccountResponse> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Account not found.');
    }
    const userObjectId = new Types.ObjectId(id);

    // Atomic conditional update to prevent double-click duplicate notifications and audits
    const updatedUser = await this.userModel
      .findOneAndUpdate(
        {
          _id: userObjectId,
          role: { $ne: Role.Admin },
          status: AccountStatus.Active,
        },
        { $set: { status: AccountStatus.Suspended } },
        { new: true },
      )
      .exec();

    if (!updatedUser) {
      const existing = await this.userModel.findById(userObjectId).exec();
      if (!existing) {
        throw new NotFoundException('Account not found.');
      }
      if (existing.role === Role.Admin) {
        throw new ForbiddenException(
          'Not an admin, or the target is an admin.',
        );
      }
      throw new ConflictException(
        'The account is not active (already suspended or deactivated).',
      );
    }

    // Revoke all active sessions of this user (NEW-07, ACC-15, ACC-16)
    await this.sessionsService.revokeAllForUser(updatedUser._id);

    // In-app notification to affected user (GEN-01)
    await this.notificationsService.notify(
      updatedUser._id,
      'Account Suspended',
      dto?.reason
        ? `Your account has been suspended: ${dto.reason}`
        : 'Your account has been suspended by an administrator.',
    );

    // Write to audit log (GEN-07)
    await this.auditService.record({
      adminId: admin.id,
      action: 'suspend_account',
      targetType: 'account',
      targetId: updatedUser._id.toString(),
      details: {
        reason: dto?.reason,
        email: updatedUser.email,
        role: updatedUser.role,
        previousStatus: AccountStatus.Active,
        newStatus: AccountStatus.Suspended,
      },
    });

    return this.toAccountResponse(updatedUser);
  }

  // ACC-15, ACC-16: Reactivate a suspended user or moderator account
  async reactivateAccount(
    admin: AuthUser,
    id: string,
    dto?: AdminActionDto,
  ): Promise<AccountResponse> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Account not found.');
    }
    const userObjectId = new Types.ObjectId(id);

    // Atomic conditional update to prevent double-click duplicate notifications and audits
    const updatedUser = await this.userModel
      .findOneAndUpdate(
        {
          _id: userObjectId,
          status: AccountStatus.Suspended,
        },
        {
          $set: {
            status: AccountStatus.Active,
            failedLoginAttempts: 0,
            lockUntil: null,
          },
        },
        { new: true },
      )
      .exec();

    if (!updatedUser) {
      const existing = await this.userModel.findById(userObjectId).exec();
      if (!existing) {
        throw new NotFoundException('Account not found.');
      }
      throw new ConflictException('The account is not suspended.');
    }

    // In-app notification to affected user (GEN-01)
    await this.notificationsService.notify(
      updatedUser._id,
      'Account Reactivated',
      dto?.reason
        ? `Your account has been reactivated: ${dto.reason}`
        : 'Your account has been reactivated. You may now log in again.',
    );

    // Write to audit log (GEN-07)
    await this.auditService.record({
      adminId: admin.id,
      action: 'reactivate_account',
      targetType: 'account',
      targetId: updatedUser._id.toString(),
      details: {
        reason: dto?.reason,
        email: updatedUser.email,
        role: updatedUser.role,
        previousStatus: AccountStatus.Suspended,
        newStatus: AccountStatus.Active,
      },
    });

    return this.toAccountResponse(updatedUser);
  }

  // ACC-15: Deactivate an airline
  async deactivateAirline(
    admin: AuthUser,
    id: string,
    dto?: AdminActionDto,
  ): Promise<ProviderActionResponse> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Airline not found.');
    }
    const db = this.connection.db;
    const objectId = new Types.ObjectId(id);

    const updateResult = await db
      ?.collection('airlines')
      .updateOne(
        { _id: objectId, active: { $ne: false } },
        { $set: { active: false, updatedAt: new Date() } },
      );

    if (!updateResult || updateResult.matchedCount === 0) {
      const airline = await db
        ?.collection('airlines')
        .findOne({ _id: objectId });
      if (!airline) {
        throw new NotFoundException('Airline not found.');
      }
      throw new ConflictException('The airline is already deactivated.');
    }

    // Notify assigned moderator if any (GEN-01)
    const moderator = await this.userModel.findOne({
      role: Role.AirlineModerator,
      airlineId: objectId,
    });
    if (moderator) {
      await this.notificationsService.notify(
        moderator._id,
        'Airline Deactivated',
        dto?.reason
          ? `Your assigned airline has been deactivated: ${dto.reason}`
          : 'Your assigned airline has been deactivated by an administrator.',
      );
    }

    await this.auditService.record({
      adminId: admin.id,
      action: 'deactivate_airline',
      targetType: 'airline',
      targetId: id,
      details: { reason: dto?.reason },
    });

    return { id, active: false, message: 'Airline deactivated successfully.' };
  }

  // ACC-15: Reactivate an airline
  async reactivateAirline(
    admin: AuthUser,
    id: string,
    dto?: AdminActionDto,
  ): Promise<ProviderActionResponse> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Airline not found.');
    }
    const db = this.connection.db;
    const objectId = new Types.ObjectId(id);

    const updateResult = await db
      ?.collection('airlines')
      .updateOne(
        { _id: objectId, active: false },
        { $set: { active: true, updatedAt: new Date() } },
      );

    if (!updateResult || updateResult.matchedCount === 0) {
      const airline = await db
        ?.collection('airlines')
        .findOne({ _id: objectId });
      if (!airline) {
        throw new NotFoundException('Airline not found.');
      }
      throw new ConflictException('The airline is not deactivated.');
    }

    const moderator = await this.userModel.findOne({
      role: Role.AirlineModerator,
      airlineId: objectId,
    });
    if (moderator) {
      await this.notificationsService.notify(
        moderator._id,
        'Airline Reactivated',
        dto?.reason
          ? `Your assigned airline has been reactivated: ${dto.reason}`
          : 'Your assigned airline has been reactivated.',
      );
    }

    await this.auditService.record({
      adminId: admin.id,
      action: 'reactivate_airline',
      targetType: 'airline',
      targetId: id,
      details: { reason: dto?.reason },
    });

    return { id, active: true, message: 'Airline reactivated successfully.' };
  }

  // ACC-15: Deactivate a hotel
  async deactivateHotel(
    admin: AuthUser,
    id: string,
    dto?: AdminActionDto,
  ): Promise<ProviderActionResponse> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Hotel not found.');
    }
    const db = this.connection.db;
    const objectId = new Types.ObjectId(id);

    const updateResult = await db
      ?.collection('hotels')
      .updateOne(
        { _id: objectId, active: { $ne: false } },
        { $set: { active: false, updatedAt: new Date() } },
      );

    if (!updateResult || updateResult.matchedCount === 0) {
      const hotel = await db?.collection('hotels').findOne({ _id: objectId });
      if (!hotel) {
        throw new NotFoundException('Hotel not found.');
      }
      throw new ConflictException('The hotel is already deactivated.');
    }

    const moderator = await this.userModel.findOne({
      role: Role.HotelModerator,
      hotelId: objectId,
    });
    if (moderator) {
      await this.notificationsService.notify(
        moderator._id,
        'Hotel Deactivated',
        dto?.reason
          ? `Your assigned hotel has been deactivated: ${dto.reason}`
          : 'Your assigned hotel has been deactivated by an administrator.',
      );
    }

    await this.auditService.record({
      adminId: admin.id,
      action: 'deactivate_hotel',
      targetType: 'hotel',
      targetId: id,
      details: { reason: dto?.reason },
    });

    return { id, active: false, message: 'Hotel deactivated successfully.' };
  }

  // ACC-15: Reactivate a hotel
  async reactivateHotel(
    admin: AuthUser,
    id: string,
    dto?: AdminActionDto,
  ): Promise<ProviderActionResponse> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Hotel not found.');
    }
    const db = this.connection.db;
    const objectId = new Types.ObjectId(id);

    const updateResult = await db
      ?.collection('hotels')
      .updateOne(
        { _id: objectId, active: false },
        { $set: { active: true, updatedAt: new Date() } },
      );

    if (!updateResult || updateResult.matchedCount === 0) {
      const hotel = await db?.collection('hotels').findOne({ _id: objectId });
      if (!hotel) {
        throw new NotFoundException('Hotel not found.');
      }
      throw new ConflictException('The hotel is not deactivated.');
    }

    const moderator = await this.userModel.findOne({
      role: Role.HotelModerator,
      hotelId: objectId,
    });
    if (moderator) {
      await this.notificationsService.notify(
        moderator._id,
        'Hotel Reactivated',
        dto?.reason
          ? `Your assigned hotel has been reactivated: ${dto.reason}`
          : 'Your assigned hotel has been reactivated.',
      );
    }

    await this.auditService.record({
      adminId: admin.id,
      action: 'reactivate_hotel',
      targetType: 'hotel',
      targetId: id,
      details: { reason: dto?.reason },
    });

    return { id, active: true, message: 'Hotel reactivated successfully.' };
  }

  private toAccountResponse(user: UserDocument): AccountResponse {
    const res: AccountResponse = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
    };
    if (user.role === Role.AirlineModerator && user.airlineId) {
      res.airlineId = user.airlineId.toString();
    }
    if (user.role === Role.HotelModerator && user.hotelId) {
      res.hotelId = user.hotelId.toString();
    }
    return res;
  }
}
