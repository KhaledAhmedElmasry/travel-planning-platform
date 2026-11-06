import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, FilterQuery, Model, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { SessionsService } from '../auth/sessions.service';
import {
  DEFAULT_PAGE_SIZE,
  getPaginationOffset,
  paginate,
  PaginatedList,
} from '../common/dto/pagination.dto';
import {
  AccountStatus,
  BookingStatus,
  BookingType,
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
import { NotificationsService } from '../notifications/notifications.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AdminActionDto } from './dto/admin-action.dto';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';

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
}
