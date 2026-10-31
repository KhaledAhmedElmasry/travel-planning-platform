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
