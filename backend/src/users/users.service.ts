import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccountStatus, Role } from '../common/enums';
import { User, UserDocument } from './schemas/user.schema';

// What registration (ACC-01, ACC-03) stores. Role, status and the security counters are never
// taken from the request.
export interface NewRegisteredUser {
  name: string;
  email: string;
  passwordHash: string;
  termsAcceptedAt: Date;
}

// Area: Auth & Accounts
// Business logic and database access for: ACC-09, ACC-11, ACC-12
// Also used by AuthService for registration (ACC-01, ACC-03).
@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly config: ConfigService,
  ) {}

  // ACC-04: the account with its password hash, which normal queries never return.
  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.trim().toLowerCase() })
      .select('+passwordHash')
      .exec();
  }

  // ACC-05: count one more failed login. When the count reaches maxAttempts the account is locked
  // until now + lockForMs and the counter starts again from 0. Returns the lock end, or null if
  // the account is not locked by this attempt.
  // $inc is atomic, so parallel wrong guesses are all counted and cannot slip past the limit.
  async recordFailedLogin(
    userId: Types.ObjectId,
    maxAttempts: number,
    lockForMs: number,
  ): Promise<Date | null> {
    const updated = await this.userModel
      .findOneAndUpdate(
        { _id: userId },
        { $inc: { failedLoginAttempts: 1 } },
        { new: true },
      )
      .exec();
    if (!updated || updated.failedLoginAttempts < maxAttempts) return null;

    const lockUntil = new Date(Date.now() + lockForMs);
    await this.userModel
      .updateOne(
        { _id: userId, failedLoginAttempts: { $gte: maxAttempts } },
        { $set: { lockUntil, failedLoginAttempts: 0 } },
      )
      .exec();
    return lockUntil;
  }

  // ACC-05: a successful login resets the counter and any expired lock.
  async resetFailedLogins(userId: Types.ObjectId): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: userId },
        { $set: { failedLoginAttempts: 0, lockUntil: null } },
      )
      .exec();
  }

  // ACC-07a: replace the password with a temporary one that must be changed at the next login.
  // Also clears any login lockout (ACC-05), so the account can log in with it straight away.
  // Returns false if the account does not exist.
  async setTemporaryPassword(
    userId: Types.ObjectId,
    passwordHash: string,
  ): Promise<boolean> {
    const result = await this.userModel
      .updateOne(
        { _id: userId },
        {
          $set: {
            passwordHash,
            mustChangePassword: true,
            failedLoginAttempts: 0,
            lockUntil: null,
          },
        },
      )
      .exec();
    return result.matchedCount === 1;
  }

  findById(id: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(id)) return Promise.resolve(null);
    return this.userModel.findById(id).exec();
  }

  // Emails are stored lowercased, so the lookup is case-insensitive.
  async existsByEmail(email: string): Promise<boolean> {
    const found = await this.userModel
      .exists({ email: email.trim().toLowerCase() })
      .exec();
    return found !== null;
  }

  // ACC-03: a new account is always a Registered User with status Active. The preferred currency
  // starts as the platform currency and can be changed later (ACC-09).
  // Throws MongoDB error 11000 if the email is already registered (unique index).
  createRegisteredUser(data: NewRegisteredUser): Promise<UserDocument> {
    return this.userModel.create({
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      termsAcceptedAt: data.termsAcceptedAt,
      role: Role.User,
      status: AccountStatus.Active,
      preferredCurrency: this.config.getOrThrow<string>('PLATFORM_CURRENCY'),
    });
  }
}
