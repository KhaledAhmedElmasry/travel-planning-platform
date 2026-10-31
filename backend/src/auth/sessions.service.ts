import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { Model, Types } from 'mongoose';
import { AccountStatus, Role } from '../common/enums';
import type { AuthUser } from '../common/interfaces';
import { UsersService } from '../users/users.service';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  AuthTokens,
  SESSION_IDLE_SECONDS,
} from './auth-cookies';
import { Session } from './schemas/session.schema';

interface TokenPayload {
  sub: string; // user id
  sid: string; // session id
}

const SESSION_ENDED = 'Your session has ended. Please log in again';
export const ACCOUNT_SUSPENDED = 'Account suspended';

// Area: Auth & Accounts
// Token-based sessions (NEW-07) and the check behind JwtAuthGuard (ACC-04, ACC-19).
// Exported by AuthModule, which is global, so the guard works in every module.
@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(Session.name) private readonly sessionModel: Model<Session>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  // ACC-04, NEW-07: a new session for a successful login, with its access and refresh tokens.
  async start(userId: string): Promise<AuthTokens> {
    const sessionId = new Types.ObjectId();
    const payload: TokenPayload = { sub: userId, sid: sessionId.toString() };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: SESSION_IDLE_SECONDS,
      }),
    ]);

    const now = new Date();
    await this.sessionModel.create({
      _id: sessionId,
      userId: new Types.ObjectId(userId),
      tokenHash: hashToken(refreshToken),
      lastActivityAt: now,
      expiresAt: new Date(now.getTime() + SESSION_IDLE_SECONDS * 1000),
    });

    return { accessToken, refreshToken };
  }

  // JwtAuthGuard: the logged-in account for an access token, or 401/403.
  // TODO NEW-07 / ACC-06: update lastActivityAt here for the 30-minute idle expiry.
  async authenticate(accessToken: string): Promise<AuthUser> {
    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(accessToken, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(SESSION_ENDED);
    }

    // A logged-out or revoked session stops working at once, even with an unexpired token.
    const session = Types.ObjectId.isValid(payload.sid)
      ? await this.sessionModel.findById(payload.sid).exec()
      : null;
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.userId.toString() !== payload.sub
    ) {
      throw new UnauthorizedException(SESSION_ENDED);
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || user.status === AccountStatus.Deactivated) {
      throw new UnauthorizedException(SESSION_ENDED);
    }
    // Suspended accounts are rejected on every request (task sheet, ACC-15).
    if (user.status === AccountStatus.Suspended) {
      throw new ForbiddenException(ACCOUNT_SUSPENDED);
    }

    return {
      id: user._id.toString(),
      role: user.role,
      sessionId: payload.sid,
      airlineId:
        user.role === Role.AirlineModerator && user.airlineId
          ? user.airlineId.toString()
          : null,
      hotelId:
        user.role === Role.HotelModerator && user.hotelId
          ? user.hotelId.toString()
          : null,
    };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
