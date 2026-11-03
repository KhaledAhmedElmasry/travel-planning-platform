import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { SessionsService } from '../auth/sessions.service';
import { AccountStatus, Role } from '../common/enums';
import type { AuthUser } from '../common/interfaces';
import { NotificationsService } from '../notifications/notifications.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AdminActionDto } from './dto/admin-action.dto';

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

  // ACC-15, ACC-16: Suspend a user or moderator account
  async suspendAccount(
    admin: AuthUser,
    id: string,
    dto?: AdminActionDto,
  ): Promise<AccountResponse> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Account not found.');
    }

    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('Account not found.');
    }

    if (user.role === Role.Admin) {
      throw new ForbiddenException('Not an admin, or the target is an admin.');
    }

    if (user.status !== AccountStatus.Active) {
      throw new ConflictException(
        'The account is not active (already suspended or deactivated).',
      );
    }

    user.status = AccountStatus.Suspended;
    await user.save();

    // Revoke all active sessions of this user (NEW-07, ACC-15)
    await this.sessionsService.revokeAllForUser(user._id);

    // In-app notification to affected user (GEN-01)
    await this.notificationsService.notify(
      user._id,
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
      targetId: user._id.toString(),
      details: {
        reason: dto?.reason,
        email: user.email,
        role: user.role,
        previousStatus: AccountStatus.Active,
        newStatus: AccountStatus.Suspended,
      },
    });

    return this.toAccountResponse(user);
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

    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('Account not found.');
    }

    if (user.status !== AccountStatus.Suspended) {
      throw new ConflictException('The account is not suspended.');
    }

    user.status = AccountStatus.Active;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    // In-app notification to affected user (GEN-01)
    await this.notificationsService.notify(
      user._id,
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
      targetId: user._id.toString(),
      details: {
        reason: dto?.reason,
        email: user.email,
        role: user.role,
        previousStatus: AccountStatus.Suspended,
        newStatus: AccountStatus.Active,
      },
    });

    return this.toAccountResponse(user);
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
    const airline = await db
      ?.collection('airlines')
      .findOne({ _id: new Types.ObjectId(id) });
    if (!airline) {
      throw new NotFoundException('Airline not found.');
    }
    if (airline.active === false) {
      throw new ConflictException('The airline is already deactivated.');
    }

    await db
      ?.collection('airlines')
      .updateOne(
        { _id: new Types.ObjectId(id) },
        { $set: { active: false, updatedAt: new Date() } },
      );

    // Notify assigned moderator if any (GEN-01)
    const moderator = await this.userModel.findOne({
      role: Role.AirlineModerator,
      airlineId: new Types.ObjectId(id),
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
    const airline = await db
      ?.collection('airlines')
      .findOne({ _id: new Types.ObjectId(id) });
    if (!airline) {
      throw new NotFoundException('Airline not found.');
    }
    if (airline.active !== false) {
      throw new ConflictException('The airline is not deactivated.');
    }

    await db
      ?.collection('airlines')
      .updateOne(
        { _id: new Types.ObjectId(id) },
        { $set: { active: true, updatedAt: new Date() } },
      );

    const moderator = await this.userModel.findOne({
      role: Role.AirlineModerator,
      airlineId: new Types.ObjectId(id),
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
    const hotel = await db
      ?.collection('hotels')
      .findOne({ _id: new Types.ObjectId(id) });
    if (!hotel) {
      throw new NotFoundException('Hotel not found.');
    }
    if (hotel.active === false) {
      throw new ConflictException('The hotel is already deactivated.');
    }

    await db
      ?.collection('hotels')
      .updateOne(
        { _id: new Types.ObjectId(id) },
        { $set: { active: false, updatedAt: new Date() } },
      );

    const moderator = await this.userModel.findOne({
      role: Role.HotelModerator,
      hotelId: new Types.ObjectId(id),
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
    const hotel = await db
      ?.collection('hotels')
      .findOne({ _id: new Types.ObjectId(id) });
    if (!hotel) {
      throw new NotFoundException('Hotel not found.');
    }
    if (hotel.active !== false) {
      throw new ConflictException('The hotel is not deactivated.');
    }

    await db
      ?.collection('hotels')
      .updateOne(
        { _id: new Types.ObjectId(id) },
        { $set: { active: true, updatedAt: new Date() } },
      );

    const moderator = await this.userModel.findOne({
      role: Role.HotelModerator,
      hotelId: new Types.ObjectId(id),
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
