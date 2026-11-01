import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AccountStatus, Role } from '../common/enums';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { BCRYPT_ROUNDS } from './password-rule';

// openapi.yaml POST /api/auth/register 201: the profile without any password fields.
export interface RegisterResponse {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: AccountStatus;
  createdAt: Date;
}

const EMAIL_TAKEN = 'An account with this email already exists';

// Area: Auth & Accounts
// Business logic and database access for: ACC-01, ACC-03, ACC-04, ACC-05, ACC-06, ACC-08, ACC-19, NEW-07
@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

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
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}
