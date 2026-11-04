import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { AccountStatus, Role } from '../common/enums';
import type { AuthUser } from '../common/interfaces';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { AuthTokens } from './auth-cookies';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import {
  isLocked,
  LOCK_DURATION_MS,
  lockedMessage,
  MAX_FAILED_LOGINS,
} from './login-lockout';
import { RegisterDto } from './dto/register.dto';
import { BCRYPT_ROUNDS } from './password-rule';
import { ACCOUNT_SUSPENDED, SessionsService } from './sessions.service';

// openapi.yaml POST /api/auth/register 201: the profile without any password fields.
export interface RegisterResponse {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: AccountStatus;
  createdAt: Date;
}

// openapi.yaml POST /api/auth/login 200. airlineId / hotelId only for moderators (ACC-13).
export interface AccountResponse {
  id: string;
  name: string;
  email: string;
  role: Role;
  airlineId?: string;
  hotelId?: string;
  mustChangePassword: boolean;
}

// openapi.yaml GET /api/auth/me 200: the account plus its status.
export interface MeResponse extends AccountResponse {
  status: AccountStatus;
}

// POST /api/admin/users/:id/reset-password 200 (ACC-07a).
export interface ResetPasswordResponse {
  message: string;
  id: string;
  mustChangePassword: true;
}

// PATCH /api/auth/change-password 200 (ACC-08).
export interface ChangePasswordResponse {
  message: string;
}

export interface LoginResult {
  account: AccountResponse;
  tokens: AuthTokens;
}

const EMAIL_TAKEN = 'An account with this email already exists';
// ACC-04: one generic message, so nobody can find out which emails are registered.
const INVALID_CREDENTIALS = 'Invalid email or password';

// GEN-02: a 400 for one form field, in the Error format of openapi.yaml (fieldErrors).
function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({
    message,
    fieldErrors: [{ field, messages: [message] }],
  });
}
const ACCOUNT_DEACTIVATED = 'This account has been deactivated';

// Area: Auth & Accounts
// Business logic and database access for: ACC-01, ACC-03, ACC-04, ACC-05, ACC-06, ACC-07a, ACC-08,
// ACC-12, ACC-19, NEW-07
@Injectable()
export class AuthService {
  // Compared against when the email is unknown, so a wrong email takes as long as a wrong
  // password and the response time does not reveal which emails exist (ACC-04).
  private readonly dummyHash = bcrypt.hash('no-such-account', BCRYPT_ROUNDS);

  constructor(
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
  ) {}

  // ACC-01, ACC-03: create a Registered User account with status Active.
  async register(dto: RegisterDto): Promise<RegisterResponse> {
    const email = dto.email.trim().toLowerCase();

    // Gives the clear 409 in the normal case, before spending time on hashing.
    if (await this.usersService.existsByEmail(email)) {
      throw new ConflictException(EMAIL_TAKEN);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      const user = await this.usersService.createRegisteredUser({
        name: dto.name.trim(),
        email,
        passwordHash,
        termsAcceptedAt: new Date(),
      });
      return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt!,
      };
    } catch (err) {
      // Two registrations with the same email at the same moment can both pass the check above;
      // the unique index on email rejects the second one with MongoDB error 11000.
      if (isDuplicateKeyError(err)) throw new ConflictException(EMAIL_TAKEN);
      throw err;
    }
  }

  // ACC-04: log in any role with email and password and start a session (NEW-07).
  // ACC-05: 5 consecutive wrong passwords lock the account for 15 minutes.
  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);

    // ACC-05: a locked account is refused before the password is checked, even the right one.
    if (user && isLocked(user.lockUntil)) {
      throw new ForbiddenException(lockedMessage(user.lockUntil));
    }

    const passwordOk = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? (await this.dummyHash),
    );

    if (!user || !passwordOk) {
      if (user) {
        // ACC-05: the 5th wrong password locks the account and shows the lockout message at once.
        const lockedUntil = await this.usersService.recordFailedLogin(
          user._id,
          MAX_FAILED_LOGINS,
          LOCK_DURATION_MS,
        );
        if (lockedUntil) {
          throw new ForbiddenException(lockedMessage(lockedUntil));
        }
      }
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // Checked only after the right password, so these messages never reveal an account to
    // someone who does not know its password.
    if (user.status === AccountStatus.Suspended) {
      throw new ForbiddenException(ACCOUNT_SUSPENDED);
    }
    if (user.status === AccountStatus.Deactivated) {
      throw new ForbiddenException(ACCOUNT_DEACTIVATED);
    }

    // ACC-05: a successful login resets the counter, so only consecutive failures count.
    if (user.failedLoginAttempts > 0 || user.lockUntil) {
      await this.usersService.resetFailedLogins(user._id);
    }

    const tokens = await this.sessionsService.start(user._id.toString());
    return { account: toAccount(user), tokens };
  }

  // ACC-06: revoke the current session on the server. The controller clears the cookies.
  logout(sessionId: string): Promise<void> {
    return this.sessionsService.revoke(sessionId);
  }

  // ACC-07a: an admin sets a temporary password for a registered user or a moderator. The account
  // must set a new one at its next login, and every session it has is revoked at once.
  // Admin accounts are seeded (ACC-18) and cannot be reset here.
  async resetPasswordByAdmin(
    targetId: Types.ObjectId,
    temporaryPassword: string,
  ): Promise<ResetPasswordResponse> {
    const target = await this.usersService.findById(targetId.toString());
    if (!target) throw new NotFoundException('Account not found');
    if (target.role === Role.Admin) {
      throw new ForbiddenException(
        "Only a registered user's or a moderator's password can be reset",
      );
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);
    if (
      !(await this.usersService.setTemporaryPassword(targetId, passwordHash))
    ) {
      throw new NotFoundException('Account not found');
    }
    await this.sessionsService.revokeAllForUser(targetId);

    // WAITING FOR (GEN-07): AuditService. Record action "reset_password" with the admin id and
    // targetId here once it is implemented.
    return {
      message:
        'Password reset. The account must set a new password at its next login',
      id: targetId.toString(),
      mustChangePassword: true,
    };
  }

  // ACC-08: change the own password with the current one. Ends a temporary password (ACC-07a,
  // ACC-13). The new password must meet the rules (checked by the DTO) and differ from the current
  // one. Other devices are signed out; this session stays logged in.
  async changePassword(
    user: AuthUser,
    dto: ChangePasswordDto,
  ): Promise<ChangePasswordResponse> {
    const account = await this.usersService.findByIdWithPassword(user.id);
    // The guard has just loaded this account, so this only happens if it was deleted meanwhile.
    if (!account) throw new UnauthorizedException('You must be logged in');

    // GEN-02: returned as field errors, so the form shows them under the right field.
    if (!(await bcrypt.compare(dto.currentPassword, account.passwordHash))) {
      throw fieldError('currentPassword', 'Current password is incorrect');
    }
    if (await bcrypt.compare(dto.newPassword, account.passwordHash)) {
      throw fieldError(
        'newPassword',
        'New password must be different from the current password',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.usersService.setPassword(account._id, passwordHash);
    await this.sessionsService.revokeOthers(account._id, user.sessionId);
    return { message: 'Password changed' };
  }

  // ACC-12: a registered user deactivates their own account (the frontend asks for confirmation
  // first, GEN-03). Blocked while they have an upcoming Confirmed booking. Afterwards they cannot
  // log in (ACC-04) and every session is revoked at once.
  async deactivateOwnAccount(user: AuthUser): Promise<void> {
    const userId = new Types.ObjectId(user.id);
    if (await this.usersService.hasUpcomingConfirmedBookings(userId)) {
      throw new ConflictException(
        'You have upcoming confirmed bookings. Cancel them or wait until they have started before deactivating your account',
      );
    }
    await this.usersService.deactivate(userId);
    await this.sessionsService.revokeAllForUser(userId);
  }

  // ACC-04, ACC-19: the account of the current session, for GET /api/auth/me.
  async me(userId: string): Promise<MeResponse> {
    const user = await this.usersService.findById(userId);
    // The guard has just loaded this account, so this only happens if it was deleted meanwhile.
    if (!user) throw new UnauthorizedException('You must be logged in');
    return { ...toAccount(user), status: user.status };
  }
}

function toAccount(user: UserDocument): AccountResponse {
  const account: AccountResponse = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
  if (user.role === Role.AirlineModerator && user.airlineId) {
    account.airlineId = user.airlineId.toString();
  }
  if (user.role === Role.HotelModerator && user.hotelId) {
    account.hotelId = user.hotelId.toString();
  }
  return account;
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}
