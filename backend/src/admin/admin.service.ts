import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Connection, FilterQuery, Model, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { BCRYPT_ROUNDS } from '../auth/password-rule';
import { SessionsService } from '../auth/sessions.service';
import {
  DEFAULT_PAGE_SIZE,
  getPaginationOffset,
  paginate,
  PaginatedList,
} from '../common/dto/pagination.dto';
import {
  AccountStatus,
  AuditAction,
  BookingStatus,
  BookingType,
  ProviderType,
  Role,
} from '../common/enums';
import type { AuthUser } from '../common/interfaces';
import {
  FlightBooking,
  FlightBookingDocument,
} from '../flight-bookings/schemas/flight-booking.schema';
import {
  HotelBooking,
  HotelBookingDocument,
} from '../hotel-bookings/schemas/hotel-booking.schema';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AdminActionDto } from './dto/admin-action.dto';
import { CreateModeratorDto } from './dto/create-moderator.dto';
import {
  AnalyticsDateFilterBy,
  AnalyticsQueryDto,
} from './dto/analytics-query.dto';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { ListProvidersQueryDto } from './dto/list-providers-query.dto';

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

export interface AdminBookingUser {
  id: string;
  name: string;
  email: string;
}

export interface AdminBookingProvider {
  id: string;
  name: string;
  type: string;
}

export interface AdminBookingDates {
  from: string;
  to: string;
  startDate?: string;
  endDate?: string;
}

export interface AdminBookingItem {
  id: string;
  type: BookingType;
  reference: string | null;
  user: AdminBookingUser;
  provider: AdminBookingProvider;
  dates: AdminBookingDates;
  amount: number;
  currency: string;
  status: BookingStatus;
  createdAt: Date;
}

export interface AnalyticsSummary {
  totalBookings: number;
  confirmedBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  pendingBookings: number;
  totalRevenue: number;
  currency: string;
  period: {
    from?: string;
    to?: string;
  };
}

export interface ProviderAnalyticsItem {
  providerId: string;
  providerName: string;
  providerType: ProviderType;
  totalBookings: number;
  confirmedBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  pendingBookings: number;
  totalRevenue: number;
  currency: string;
}

export interface AdminAnalyticsResponse extends PaginatedList<ProviderAnalyticsItem> {
  summary: AnalyticsSummary;
}

export type LeanFlightBooking = FlightBooking & { _id: Types.ObjectId };
export type LeanHotelBooking = HotelBooking & { _id: Types.ObjectId };

export interface TaggedFlightBooking extends LeanFlightBooking {
  _type: BookingType.Flight;
}

export interface TaggedHotelBooking extends LeanHotelBooking {
  _type: BookingType.Hotel;
}

export type TaggedBooking = TaggedFlightBooking | TaggedHotelBooking;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Area: Auth & Accounts
// Business logic and database access for: ACC-07a, ACC-13, ACC-14, ACC-15, ACC-16, ACC-17
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly sessionsService: SessionsService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    @InjectModel(FlightBooking.name)
    private readonly flightBookingModel: Model<FlightBookingDocument>,
    @InjectModel(HotelBooking.name)
    private readonly hotelBookingModel: Model<HotelBookingDocument>,
    private readonly mailService: MailService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  // PAY-04: the platform currency (validated at startup, env.validation.ts).
  private platformCurrency(): string {
    return this.configService?.get<string>('PLATFORM_CURRENCY') ?? 'USD';
  }

  // ACC-13, GEN-01-B: Create a hotel or airline moderator account
  async createModerator(
    admin: AuthUser,
    dto: CreateModeratorDto,
  ): Promise<AccountResponse> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.userModel.findOne({ email }).exec();
    if (existing) {
      throw new ConflictException('The email is already registered.');
    }

    const providerObjectId = new Types.ObjectId(dto.providerId);
    const db = this.connection.db;
    let providerName = '';

    if (dto.role === Role.AirlineModerator) {
      const airline = await db
        ?.collection('airlines')
        .findOne({ _id: providerObjectId });
      if (!airline) {
        throw new NotFoundException('The airline or hotel does not exist.');
      }
      providerName = (airline as { name?: string }).name ?? 'Airline';
    } else if (dto.role === Role.HotelModerator) {
      const hotel = await db
        ?.collection('hotels')
        .findOne({ _id: providerObjectId });
      if (!hotel) {
        throw new NotFoundException('The airline or hotel does not exist.');
      }
      providerName = (hotel as { name?: string }).name ?? 'Hotel';
    } else {
      throw new BadRequestException('Invalid moderator role.');
    }

    const passwordHash = await bcrypt.hash(
      dto.temporaryPassword,
      BCRYPT_ROUNDS,
    );

    const user = new this.userModel({
      name: dto.name.trim(),
      email,
      passwordHash,
      role: dto.role,
      status: AccountStatus.Active,
      mustChangePassword: true,
      airlineId: dto.role === Role.AirlineModerator ? providerObjectId : null,
      hotelId: dto.role === Role.HotelModerator ? providerObjectId : null,
      // PAY-04: like a registered user (ACC-01), the platform currency.
      preferredCurrency: this.platformCurrency(),
      failedLoginAttempts: 0,
      lockUntil: null,
      deactivatedAt: null,
    });

    try {
      await user.save();
    } catch (error) {
      // Two requests with the same new email at once: the unique index on
      // users.email lets only one through; the other gets 409, not 500.
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('The email is already registered.');
      }
      throw error;
    }

    // GEN-07: Write to audit log
    await this.auditService.record({
      adminId: admin.id,
      action: AuditAction.CreateModerator,
      targetType: 'user',
      targetId: user._id.toString(),
      details: {
        role: dto.role,
        providerId: dto.providerId,
        providerName,
        email: user.email,
      },
    });

    // GEN-01-B: Send moderator invitation email over SMTP
    // Not awaited: a slow or unreachable mail server must not delay the answer.
    this.mailService
      .sendModeratorInvitation({
        to: user.email,
        name: user.name,
        role: dto.role,
        providerName,
        temporaryPassword: dto.temporaryPassword,
      })
      .catch((mailError: unknown) => {
        this.logger.error(
          'Failed to send moderator invitation email (GEN-01-B)',
          mailError,
        );
      });

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      airlineId: user.airlineId ? user.airlineId.toString() : undefined,
      hotelId: user.hotelId ? user.hotelId.toString() : undefined,
      mustChangePassword: user.mustChangePassword,
    };
  }

  // ACC-14: Paginated list of all accounts with search by name/email and filter by role/status
  // P-50 / P-49 (extra endpoint, MILESTONE2 spec section 8): airlines or hotels by name A to Z,
  // 10 per page (GEN-05). search matches the name (and the code of an airline), ignoring case.
  // A provider may have several moderators (ACC-13 links each moderator to one provider): all
  // are listed; hasModerator filters on "at least one".
  async listProviders(query: ListProvidersQueryDto) {
    const isAirline = query.type === ProviderType.Airline;
    const link = isAirline ? 'airlineId' : 'hotelId';
    const moderatorRole = isAirline
      ? Role.AirlineModerator
      : Role.HotelModerator;
    const collection = this.connection.collection(
      isAirline ? 'airlines' : 'hotels',
    );

    const filter: Record<string, unknown> = {};
    if (query.search) {
      const regex = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = isAirline
        ? [{ name: regex }, { code: regex }]
        : [{ name: regex }];
    }
    if (query.active !== undefined) filter.active = query.active;
    if (query.hasModerator !== undefined) {
      const moderated = await this.userModel
        .distinct(link, { role: moderatorRole, [link]: { $ne: null } })
        .exec();
      filter._id = query.hasModerator
        ? { $in: moderated }
        : { $nin: moderated };
    }

    const page = query.page ?? 1;
    const { skip, limit } = getPaginationOffset(page, DEFAULT_PAGE_SIZE);
    const [providers, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ name: 1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ]);
    const moderators = await this.userModel
      .find({
        role: moderatorRole,
        [link]: { $in: providers.map((p) => p._id) },
      })
      .sort({ name: 1, _id: 1 })
      .exec();

    const items = providers.map((p) => {
      const id = String(p._id);
      return {
        id,
        type: query.type,
        name: p.name as string,
        ...(isAirline
          ? {
              code: p.code as string,
              logoUrl: (p.logoUrl as string | null) ?? null,
            }
          : {
              cityId: p.cityId as string,
              countryCode: p.countryCode as string,
              photoUrl:
                (p.photos as { url: string }[] | undefined)?.[0]?.url ?? null,
            }),
        active: p.active !== false,
        moderators: moderators
          .filter((m) => String(m[link]) === id)
          .map((m) => ({ id: m._id.toString(), name: m.name, email: m.email })),
        createdAt: p.createdAt as Date,
      };
    });
    return paginate(items, total, page, DEFAULT_PAGE_SIZE);
  }

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

    // Revoke all active sessions of this user (ACC-19, ACC-15, ACC-16)
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

  // ACC-15 / PDF 8.2: "Affected parties must receive an in-app notification."
  // Besides the provider's moderator, every user who has a Confirmed booking
  // with the provider is told once (one message per user, with the number of
  // their bookings). Their bookings stay valid. This runs only after the
  // conditional deactivation above succeeded, so it happens once per
  // deactivation. A failure here is logged and never undoes the deactivation.
  private async notifyBookedUsers(
    type: BookingType,
    providerId: Types.ObjectId,
    providerKind: 'airline' | 'hotel',
    reason?: string,
  ): Promise<void> {
    try {
      const rows: { _id: Types.ObjectId; count: number }[] =
        type === BookingType.Flight
          ? await this.flightBookingModel.aggregate([
              {
                $match: {
                  status: BookingStatus.Confirmed,
                  'segments.airlineId': providerId,
                },
              },
              { $group: { _id: '$userId', count: { $sum: 1 } } },
            ])
          : await this.hotelBookingModel.aggregate([
              {
                $match: {
                  status: BookingStatus.Confirmed,
                  hotelId: providerId,
                },
              },
              { $group: { _id: '$userId', count: { $sum: 1 } } },
            ]);
      const label = providerKind === 'airline' ? 'Airline' : 'Hotel';
      for (const row of rows) {
        const what =
          row.count === 1
            ? `Your Confirmed ${providerKind === 'airline' ? 'flight booking' : 'hotel reservation'} with this ${providerKind} stays valid.`
            : `Your ${row.count} Confirmed ${providerKind === 'airline' ? 'flight bookings' : 'hotel reservations'} with this ${providerKind} stay valid.`;
        await this.notificationsService.notify(
          row._id,
          `${label} deactivated`,
          `A ${providerKind} you booked has been deactivated by an administrator${reason ? `: ${reason}` : ''}. It can no longer be booked. ${what}`,
          'provider_deactivated',
        );
      }
    } catch (error) {
      this.logger.error(
        `Could not notify the booked users of the deactivated ${providerKind} ${providerId.toString()}: ${String(error)}`,
      );
    }
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

    await this.notifyBookedUsers(
      BookingType.Flight,
      objectId,
      'airline',
      dto?.reason,
    );

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

    await this.notifyBookedUsers(
      BookingType.Hotel,
      objectId,
      'hotel',
      dto?.reason,
    );

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

  // ACC-17: View a read-only list of all flight and hotel bookings, filterable by type, status, and date range
  async listBookings(
    query: ListBookingsQueryDto,
  ): Promise<PaginatedList<AdminBookingItem>> {
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException('from date must not be after to date');
    }

    const flightFilter: FilterQuery<FlightBookingDocument> = {};
    const hotelFilter: FilterQuery<HotelBookingDocument> = {};

    if (query.status) {
      flightFilter.status = query.status;
      hotelFilter.status = query.status;
    }

    if (query.from || query.to) {
      const departureFilter: Record<string, Date> = {};
      const checkInFilter: Record<string, Date> = {};

      if (query.from) {
        const fromDate = new Date(`${query.from}T00:00:00.000Z`);
        departureFilter.$gte = fromDate;
        checkInFilter.$gte = fromDate;
      }

      if (query.to) {
        const toDate = new Date(`${query.to}T23:59:59.999Z`);
        departureFilter.$lte = toDate;
        checkInFilter.$lte = toDate;
      }

      flightFilter['segments.0.departureAt'] = departureFilter;
      hotelFilter.checkIn = checkInFilter;
    }

    const page = query.page ?? 1;
    const { skip, limit } = getPaginationOffset(page, DEFAULT_PAGE_SIZE);

    if (query.type === BookingType.Flight) {
      const [flights, total] = await Promise.all([
        this.flightBookingModel
          .find(flightFilter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean<LeanFlightBooking[]>()
          .exec(),
        this.flightBookingModel.countDocuments(flightFilter).exec(),
      ]);

      const userMap = await this.getUserMap(flights.map((f) => f.userId));
      const items = flights.map((f) => this.mapFlightBooking(f, userMap));
      return paginate(items, total, page, DEFAULT_PAGE_SIZE);
    }

    if (query.type === BookingType.Hotel) {
      const [hotels, total] = await Promise.all([
        this.hotelBookingModel
          .find(hotelFilter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean<LeanHotelBooking[]>()
          .exec(),
        this.hotelBookingModel.countDocuments(hotelFilter).exec(),
      ]);

      const userMap = await this.getUserMap(hotels.map((h) => h.userId));
      const items = hotels.map((h) => this.mapHotelBooking(h, userMap));
      return paginate(items, total, page, DEFAULT_PAGE_SIZE);
    }

    // Both flight and hotel bookings
    const [totalFlights, totalHotels] = await Promise.all([
      this.flightBookingModel.countDocuments(flightFilter).exec(),
      this.hotelBookingModel.countDocuments(hotelFilter).exec(),
    ]);

    const total = totalFlights + totalHotels;
    if (total === 0) {
      return paginate([], 0, page, DEFAULT_PAGE_SIZE);
    }

    const fetchLimit = skip + limit;
    const [flights, hotels] = await Promise.all([
      this.flightBookingModel
        .find(flightFilter)
        .sort({ createdAt: -1 })
        .limit(fetchLimit)
        .lean<LeanFlightBooking[]>()
        .exec(),
      this.hotelBookingModel
        .find(hotelFilter)
        .sort({ createdAt: -1 })
        .limit(fetchLimit)
        .lean<LeanHotelBooking[]>()
        .exec(),
    ]);

    const taggedFlights: TaggedFlightBooking[] = flights.map((f) => ({
      ...f,
      _type: BookingType.Flight,
    }));
    const taggedHotels: TaggedHotelBooking[] = hotels.map((h) => ({
      ...h,
      _type: BookingType.Hotel,
    }));

    const combined: TaggedBooking[] = [...taggedFlights, ...taggedHotels].sort(
      (a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      },
    );

    const pagedSlice = combined.slice(skip, skip + limit);
    const userMap = await this.getUserMap(pagedSlice.map((b) => b.userId));

    const items = pagedSlice.map((b) => {
      if (b._type === BookingType.Flight) {
        return this.mapFlightBooking(b, userMap);
      }
      return this.mapHotelBooking(b, userMap);
    });

    return paginate(items, total, page, DEFAULT_PAGE_SIZE);
  }

  private async getUserMap(
    userIds: (Types.ObjectId | string | undefined)[],
  ): Promise<Map<string, AdminBookingUser>> {
    const cleanIds = [
      ...new Set(userIds.filter(Boolean).map((id) => id!.toString())),
    ];
    if (cleanIds.length === 0) {
      return new Map();
    }

    const users = await this.userModel
      .find({
        _id: { $in: cleanIds.map((id) => new Types.ObjectId(id)) },
      })
      .select('_id name email')
      .lean<{ _id: Types.ObjectId; name: string; email: string }[]>()
      .exec();

    const map = new Map<string, AdminBookingUser>();
    for (const u of users) {
      map.set(u._id.toString(), {
        id: u._id.toString(),
        name: u.name,
        email: u.email,
      });
    }
    return map;
  }

  private mapFlightBooking(
    b: LeanFlightBooking,
    userMap: Map<string, AdminBookingUser>,
  ): AdminBookingItem {
    const userIdStr = b.userId ? b.userId.toString() : '';
    const user = userMap.get(userIdStr) ?? {
      id: userIdStr,
      name: 'Unknown',
      email: '',
    };

    const firstSeg = b.segments?.[0];
    const lastSeg =
      b.segments && b.segments.length > 0
        ? b.segments[b.segments.length - 1]
        : firstSeg;

    const fromDate = firstSeg?.departureAt
      ? new Date(firstSeg.departureAt).toISOString()
      : '';
    const toDate =
      (lastSeg?.arrivalAt ?? lastSeg?.departureAt)
        ? new Date(lastSeg.arrivalAt ?? lastSeg.departureAt).toISOString()
        : '';

    const airlineName =
      firstSeg && lastSeg && firstSeg.airlineName !== lastSeg.airlineName
        ? `${firstSeg.airlineName} / ${lastSeg.airlineName}`
        : (firstSeg?.airlineName ?? 'Unknown Airline');

    return {
      id: b._id.toString(),
      type: BookingType.Flight,
      reference: b.reference ?? null,
      user,
      provider: {
        id: firstSeg?.airlineId ? firstSeg.airlineId.toString() : '',
        name: airlineName,
        type: 'airline',
      },
      dates: {
        from: fromDate,
        to: toDate,
        startDate: fromDate ? fromDate.slice(0, 10) : undefined,
        endDate: toDate ? toDate.slice(0, 10) : undefined,
      },
      amount: b.totalAmount ?? 0,
      currency: b.currency,
      status: b.status,
      createdAt: b.createdAt ?? new Date(),
    };
  }

  private mapHotelBooking(
    b: LeanHotelBooking,
    userMap: Map<string, AdminBookingUser>,
  ): AdminBookingItem {
    const userIdStr = b.userId ? b.userId.toString() : '';
    const user = userMap.get(userIdStr) ?? {
      id: userIdStr,
      name: 'Unknown',
      email: '',
    };

    const fromDate = b.checkIn
      ? new Date(b.checkIn).toISOString().slice(0, 10)
      : '';
    const toDate = b.checkOut
      ? new Date(b.checkOut).toISOString().slice(0, 10)
      : '';

    return {
      id: b._id.toString(),
      type: BookingType.Hotel,
      reference: b.reference ?? null,
      user,
      provider: {
        id: b.hotelId ? b.hotelId.toString() : '',
        name: b.hotelName ?? 'Unknown Hotel',
        type: 'hotel',
      },
      dates: {
        from: fromDate,
        to: toDate,
        startDate: fromDate,
        endDate: toDate,
      },
      amount: b.totalAmount ?? 0,
      currency: b.currency,
      status: b.status,
      createdAt: b.createdAt ?? new Date(),
    };
  }

  // BON-01: Admin analytics dashboard showing bookings and revenue per provider over a selected period
  async getAnalytics(
    query: AnalyticsQueryDto,
  ): Promise<AdminAnalyticsResponse> {
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException('from date must not be after to date');
    }

    const dateBy = query.dateBy ?? AnalyticsDateFilterBy.Created;
    const dateRangeFilter: Record<string, Date> = {};

    if (query.from) {
      dateRangeFilter.$gte = new Date(`${query.from}T00:00:00.000Z`);
    }

    if (query.to) {
      dateRangeFilter.$lte = new Date(`${query.to}T23:59:59.999Z`);
    }

    const hasDateFilter = Boolean(query.from || query.to);

    const flightFilter: FilterQuery<FlightBookingDocument> = {};
    const hotelFilter: FilterQuery<HotelBookingDocument> = {};

    if (query.status) {
      flightFilter.status = query.status;
      hotelFilter.status = query.status;
    }

    if (hasDateFilter) {
      const flightDateKey =
        dateBy === AnalyticsDateFilterBy.Travel
          ? 'segments.0.departureAt'
          : 'createdAt';
      flightFilter[flightDateKey] = dateRangeFilter;

      const hotelDateKey =
        dateBy === AnalyticsDateFilterBy.Travel ? 'checkIn' : 'createdAt';
      hotelFilter[hotelDateKey] = dateRangeFilter;
    }

    if (query.providerId && Types.ObjectId.isValid(query.providerId)) {
      const providerObjectId = new Types.ObjectId(query.providerId);
      flightFilter['segments.airlineId'] = providerObjectId;
      hotelFilter.hotelId = providerObjectId;
    }

    const currency = this.platformCurrency();
    const providerMap = new Map<string, ProviderAnalyticsItem>();

    // Seed known providers from airlines collection
    if (!query.type || query.type === ProviderType.Airline) {
      const airlineCollection = this.connection?.db?.collection<{
        _id: Types.ObjectId;
        name?: string;
      }>('airlines');
      if (airlineCollection) {
        const airlineQuery: Record<string, unknown> = {};
        if (query.providerId && Types.ObjectId.isValid(query.providerId)) {
          airlineQuery._id = new Types.ObjectId(query.providerId);
        }
        try {
          const airlines = await airlineCollection
            .find(airlineQuery)
            .project<{ _id: Types.ObjectId; name?: string }>({
              _id: 1,
              name: 1,
            })
            .toArray();
          for (const a of airlines) {
            const id = a._id.toString();
            providerMap.set(id, {
              providerId: id,
              providerName: a.name || 'Unknown Airline',
              providerType: ProviderType.Airline,
              totalBookings: 0,
              confirmedBookings: 0,
              completedBookings: 0,
              cancelledBookings: 0,
              pendingBookings: 0,
              totalRevenue: 0,
              currency,
            });
          }
        } catch {
          // If collection does not exist, continue gracefully
        }
      }
    }

    // Seed known providers from hotels collection
    if (!query.type || query.type === ProviderType.Hotel) {
      const hotelCollection = this.connection?.db?.collection<{
        _id: Types.ObjectId;
        name?: string;
      }>('hotels');
      if (hotelCollection) {
        const hotelQuery: Record<string, unknown> = {};
        if (query.providerId && Types.ObjectId.isValid(query.providerId)) {
          hotelQuery._id = new Types.ObjectId(query.providerId);
        }
        try {
          const hotels = await hotelCollection
            .find(hotelQuery)
            .project<{ _id: Types.ObjectId; name?: string }>({
              _id: 1,
              name: 1,
            })
            .toArray();
          for (const h of hotels) {
            const id = h._id.toString();
            providerMap.set(id, {
              providerId: id,
              providerName: h.name || 'Unknown Hotel',
              providerType: ProviderType.Hotel,
              totalBookings: 0,
              confirmedBookings: 0,
              completedBookings: 0,
              cancelledBookings: 0,
              pendingBookings: 0,
              totalRevenue: 0,
              currency,
            });
          }
        } catch {
          // If collection does not exist, continue gracefully
        }
      }
    }

    const shouldQueryFlights =
      !query.type || query.type === ProviderType.Airline;
    const shouldQueryHotels = !query.type || query.type === ProviderType.Hotel;

    const [flights, hotels] = await Promise.all([
      shouldQueryFlights
        ? this.flightBookingModel
            .find(flightFilter)
            .lean<LeanFlightBooking[]>()
            .exec()
        : Promise.resolve([]),
      shouldQueryHotels
        ? this.hotelBookingModel
            .find(hotelFilter)
            .lean<LeanHotelBooking[]>()
            .exec()
        : Promise.resolve([]),
    ]);

    for (const f of flights) {
      const firstSeg = f.segments?.[0];
      const airlineId = firstSeg?.airlineId
        ? firstSeg.airlineId.toString()
        : '';
      if (!airlineId) continue;
      if (query.providerId && airlineId !== query.providerId) continue;

      let provider = providerMap.get(airlineId);
      if (!provider) {
        const airlineName = firstSeg?.airlineName || 'Unknown Airline';
        provider = {
          providerId: airlineId,
          providerName: airlineName,
          providerType: ProviderType.Airline,
          totalBookings: 0,
          confirmedBookings: 0,
          completedBookings: 0,
          cancelledBookings: 0,
          pendingBookings: 0,
          totalRevenue: 0,
          currency: f.currency || currency,
        };
        providerMap.set(airlineId, provider);
      }

      provider.totalBookings++;
      const amount = f.totalAmount ?? 0;

      if (f.status === BookingStatus.Confirmed) {
        provider.confirmedBookings++;
        provider.totalRevenue += amount;
      } else if (f.status === BookingStatus.Completed) {
        provider.completedBookings++;
        provider.totalRevenue += amount;
      } else if (f.status === BookingStatus.Cancelled) {
        provider.cancelledBookings++;
      } else if (f.status === BookingStatus.PendingPayment) {
        provider.pendingBookings++;
      }
    }

    for (const h of hotels) {
      const hotelId = h.hotelId ? h.hotelId.toString() : '';
      if (!hotelId) continue;
      if (query.providerId && hotelId !== query.providerId) continue;

      let provider = providerMap.get(hotelId);
      if (!provider) {
        const hotelName = h.hotelName || 'Unknown Hotel';
        provider = {
          providerId: hotelId,
          providerName: hotelName,
          providerType: ProviderType.Hotel,
          totalBookings: 0,
          confirmedBookings: 0,
          completedBookings: 0,
          cancelledBookings: 0,
          pendingBookings: 0,
          totalRevenue: 0,
          currency: h.currency || currency,
        };
        providerMap.set(hotelId, provider);
      }

      provider.totalBookings++;
      const amount = h.totalAmount ?? 0;

      if (h.status === BookingStatus.Confirmed) {
        provider.confirmedBookings++;
        provider.totalRevenue += amount;
      } else if (h.status === BookingStatus.Completed) {
        provider.completedBookings++;
        provider.totalRevenue += amount;
      } else if (h.status === BookingStatus.Cancelled) {
        provider.cancelledBookings++;
      } else if (h.status === BookingStatus.PendingPayment) {
        provider.pendingBookings++;
      }
    }

    let providersList = Array.from(providerMap.values());
    if (query.providerId) {
      providersList = providersList.filter(
        (p) => p.providerId === query.providerId,
      );
    }
    if (query.type) {
      providersList = providersList.filter(
        (p) => p.providerType === query.type,
      );
    }

    let totalBookings = 0;
    let confirmedBookings = 0;
    let completedBookings = 0;
    let cancelledBookings = 0;
    let pendingBookings = 0;
    let totalRevenue = 0;

    for (const p of providersList) {
      totalBookings += p.totalBookings;
      confirmedBookings += p.confirmedBookings;
      completedBookings += p.completedBookings;
      cancelledBookings += p.cancelledBookings;
      pendingBookings += p.pendingBookings;
      totalRevenue += p.totalRevenue;
    }

    const summary: AnalyticsSummary = {
      totalBookings,
      confirmedBookings,
      completedBookings,
      cancelledBookings,
      pendingBookings,
      totalRevenue,
      currency,
      period: {
        from: query.from,
        to: query.to,
      },
    };

    const sortedProviders = providersList.sort((a, b) => {
      if (b.totalRevenue !== a.totalRevenue) {
        return b.totalRevenue - a.totalRevenue;
      }
      if (b.totalBookings !== a.totalBookings) {
        return b.totalBookings - a.totalBookings;
      }
      return a.providerName.localeCompare(b.providerName);
    });

    const page = query.page ?? 1;
    const { skip, limit } = getPaginationOffset(page, DEFAULT_PAGE_SIZE);
    const pagedProviders = sortedProviders.slice(skip, skip + limit);

    const paginated = paginate(
      pagedProviders,
      sortedProviders.length,
      page,
      DEFAULT_PAGE_SIZE,
    );

    return {
      ...paginated,
      summary,
    };
  }
}
