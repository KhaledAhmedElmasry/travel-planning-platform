import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AccountStatus, Role } from '../common/enums';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { AuthTokens } from './auth-cookies';
import { LoginDto } from './dto/login.dto';
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

export interface LoginResult {
  account: AccountResponse;
  tokens: AuthTokens;
}

const EMAIL_TAKEN = 'An account with this email already exists';
// ACC-04: one generic message, so nobody can find out which emails are registered.
const INVALID_CREDENTIALS = 'Invalid email or password';
const ACCOUNT_DEACTIVATED = 'This account has been deactivated';

// Area: Auth & Accounts
// Business logic and database access for: ACC-01, ACC-03, ACC-04, ACC-05, ACC-06, ACC-08, ACC-19, NEW-07
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
  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    const passwordOk = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? (await this.dummyHash),
    );

    // TODO ACC-05: before this check, reject a locked account (lockUntil in the future) with 403;
    // on a wrong password increase failedLoginAttempts and lock for 15 minutes at 5; on success
    // reset the counter.
    if (!user || !passwordOk) {
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

    const tokens = await this.sessionsService.start(user._id.toString());
    return { account: toAccount(user), tokens };
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
