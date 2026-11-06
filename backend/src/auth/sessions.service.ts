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

// ACC-06: every authenticated request moves the 30-minute idle deadline forward. To avoid a
// database write on every request, the session is updated at most once a minute.
const ACTIVITY_WRITE_INTERVAL_MS = 60 * 1000;

// Area: Auth & Accounts
// Token-based sessions (ACC-19) and the check behind JwtAuthGuard (ACC-04, ACC-19).
// Exported by AuthModule, which is global, so the guard works in every module.
@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(Session.name) private readonly sessionModel: Model<Session>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  // ACC-04, ACC-19: a new session for a successful login, with its access and refresh tokens.
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

  // ACC-06: logout revokes the session on the server, so its tokens stop working at once.
  // Revoking an already revoked session changes nothing.
  async revoke(sessionId: string): Promise<void> {
    if (!Types.ObjectId.isValid(sessionId)) return;
    await this.sessionModel
      .updateOne(
        { _id: sessionId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      )
      .exec();
  }

  // ACC-07a: an admin password reset (and later suspension ACC-15, deactivation ACC-12) ends every
  // session of the account at once, on every device.
  async revokeAllForUser(userId: Types.ObjectId): Promise<void> {
    await this.sessionModel
      .updateMany(
        { userId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      )
      .exec();
  }

  // ACC-08: after a password change, every other device is signed out; the session that made the
  // change stays logged in.
  async revokeOthers(
    userId: Types.ObjectId,
    keepSessionId: string,
  ): Promise<void> {
    await this.sessionModel
      .updateMany(
        {
          userId,
          revokedAt: null,
          _id: { $ne: new Types.ObjectId(keepSessionId) },
        },
        { $set: { revokedAt: new Date() } },
      )
      .exec();
  }

  // JwtAuthGuard: the logged-in account for an access token, or 401/403.
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
    // ACC-06: expiresAt is 30 minutes after the last authenticated request, so an idle session
    // fails here and needs a new login.
    const session = Types.ObjectId.isValid(payload.sid)
      ? await this.sessionModel.findById(payload.sid).exec()
      : null;
    const now = new Date();
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
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

    await this.recordActivity(session._id, session.lastActivityAt, now);

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
      mustChangePassword: user.mustChangePassword,
    };
  }

  private async recordActivity(
    sessionId: Types.ObjectId,
    lastActivityAt: Date,
    now: Date,
  ): Promise<void> {
    if (now.getTime() - lastActivityAt.getTime() < ACTIVITY_WRITE_INTERVAL_MS) {
      return;
    }
    await this.sessionModel
      .updateOne(
        { _id: sessionId, revokedAt: null },
        {
          $set: {
            lastActivityAt: now,
            expiresAt: new Date(now.getTime() + SESSION_IDLE_SECONDS * 1000),
          },
        },
      )
      .exec();
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
