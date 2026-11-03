import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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

// Area: Auth & Accounts
// Business logic and database access for: ACC-07a, ACC-13, ACC-14, ACC-15, ACC-16, ACC-17
@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
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

    // Revoke all active sessions of this user (NEW-07, ACC-15, ACC-16)
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
