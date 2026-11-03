import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { AccountStatus, Role } from '../common/enums';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User, UserDocument } from './schemas/user.schema';

// openapi.yaml GET /api/users/me 200 and PATCH /api/users/me 200 (ACC-09, ACC-11).
export interface ProfileResponse {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  preferredCurrency: string;
  role: Role;
  status: AccountStatus;
  createdAt: Date;
}

// The supported currencies seeded by database/seed.ts (GEN-12): { _id: 'EUR', code, name }.
// Read straight from the collection, so this does not depend on the reference-data module.
const CURRENCIES_COLLECTION = 'currencies';

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
    @InjectConnection() private readonly connection: Connection,
    private readonly config: ConfigService,
  ) {}

  // ACC-11: the own profile, for GET /api/users/me.
  async getProfile(userId: string): Promise<ProfileResponse> {
    const user = await this.findById(userId);
    // The guard has just loaded this account, so this only happens if it was deleted meanwhile.
    if (!user) throw new UnauthorizedException('You must be logged in');
    return toProfile(user);
  }

  // ACC-09: edit name, phone number and preferred currency. Saved in one update, and only if every
  // sent field is valid (the DTO checks the format, this checks the currency is supported).
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileResponse> {
    const changes: Partial<Pick<User, 'name' | 'phone' | 'preferredCurrency'>> =
      {};
    if (dto.name !== undefined) changes.name = dto.name;
    if (dto.phone !== undefined) changes.phone = dto.phone;
    if (dto.preferredCurrency !== undefined) {
      changes.preferredCurrency = dto.preferredCurrency;
    }
    if (Object.keys(changes).length === 0) {
      throw new BadRequestException(
        'Send at least one of name, phone or preferredCurrency',
      );
    }

    if (
      changes.preferredCurrency &&
      !(await this.isSupportedCurrency(changes.preferredCurrency))
    ) {
      // GEN-02: a field error, so the form shows it under the currency field.
      const message = `Preferred currency ${changes.preferredCurrency} is not supported`;
      throw new BadRequestException({
        message,
        fieldErrors: [{ field: 'preferredCurrency', messages: [message] }],
      });
    }

    const updated = await this.userModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(userId) },
        { $set: changes },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updated) throw new UnauthorizedException('You must be logged in');
    return toProfile(updated);
  }

  // GEN-12: whether a currency code is in the seeded supported list.
  async isSupportedCurrency(code: string): Promise<boolean> {
    const found = await this.connection
      .collection<{ _id: string }>(CURRENCIES_COLLECTION)
      .findOne({ _id: code }, { projection: { _id: 1 } });
    return found !== null;
  }

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

  // ACC-08: the account with its password hash, to check the current password.
  findByIdWithPassword(id: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(id)) return Promise.resolve(null);
    return this.userModel.findById(id).select('+passwordHash').exec();
  }

  // ACC-08: store a new password chosen by the account itself. This also ends a temporary
  // password (ACC-07a, ACC-13), so mustChangePassword is cleared.
  async setPassword(
    userId: Types.ObjectId,
    passwordHash: string,
  ): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: userId },
        { $set: { passwordHash, mustChangePassword: false } },
      )
      .exec();
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

function toProfile(user: UserDocument): ProfileResponse {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    preferredCurrency: user.preferredCurrency,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt!,
  };
}
