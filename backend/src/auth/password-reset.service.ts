import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { Model } from 'mongoose';
import { AccountStatus } from '../common/enums';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { BCRYPT_ROUNDS } from './password-rule';
import { EmailToken, EmailTokenPurpose } from './schemas/email-token.schema';
import { SessionsService } from './sessions.service';

// A reset link works for 30 minutes, once (ACC-07).
export const RESET_TTL_MS = 30 * 60 * 1000;
export const RESET_REQUESTED =
  'If an account with this email exists, a password reset link was sent';
export const INVALID_RESET =
  'The token is invalid, expired or already used, or the new password breaks the rules.';

// BONUS (optional): implement only after all mandatory requirements are done (PDF section 12).
// Area: Auth & Accounts (bonus)
// Requirements: ACC-07 (depends on GEN-01-B for the email itself)
//
// The link is emailed with MailService (GEN-01-B). Outside production it is also written to the
// server log, so the flow can be tested in Swagger without an email account.
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectModel(EmailToken.name)
    private readonly tokenModel: Model<EmailToken>,
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  // ACC-07: the caller always gets RESET_REQUESTED, so nobody can find out which emails exist.
  // Only an active account gets a link. A new request invalidates every older unused link.
  async requestReset(email: string): Promise<void> {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user || user.status !== AccountStatus.Active) return;

    const now = new Date();
    await this.tokenModel
      .updateMany(
        {
          userId: user._id,
          purpose: EmailTokenPurpose.ResetPassword,
          usedAt: null,
        },
        { $set: { usedAt: now } },
      )
      .exec();

    const token = randomBytes(32).toString('base64url');
    await this.tokenModel.create({
      userId: user._id,
      tokenHash: hashToken(token),
      purpose: EmailTokenPurpose.ResetPassword,
      expiresAt: new Date(now.getTime() + RESET_TTL_MS),
    });
    this.sendLink(user.email, token);
  }

  // ACC-07: set the new password with a reset token. The token is used up in the same atomic
  // update that finds it, so a link works once even with two requests at the same moment.
  // Afterwards every session of the account is revoked (ACC-19) and a login lockout is cleared.
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const used = await this.tokenModel
      .findOneAndUpdate(
        {
          tokenHash: hashToken(token),
          purpose: EmailTokenPurpose.ResetPassword,
          usedAt: null,
          expiresAt: { $gt: new Date() },
        },
        { $set: { usedAt: new Date() } },
        { new: true },
      )
      .exec();
    if (!used) throw new BadRequestException(INVALID_RESET);

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.usersService.setPassword(used.userId, passwordHash);
    await this.usersService.resetFailedLogins(used.userId);
    // Opening a link sent to the inbox also proves the email address (ACC-02).
    await this.usersService.markEmailVerified(used.userId);
    await this.sessionsService.revokeAllForUser(used.userId);
  }

  private sendLink(email: string, token: string): void {
    const frontend =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
    const link = `${frontend}/reset-password?token=${token}`;
    // MailService swallows its own errors: a failed email never changes the always-same answer.
    void this.mail.sendMail({
      to: email,
      subject: 'Reset your password',
      text: `Open this link within 30 minutes to choose a new password:\n\n${link}\n\nIf you did not ask for this, ignore this email.`,
    });
    // Development only (never in production, ACC-19): lets Swagger be used without an email account.
    if (this.config.get<string>('NODE_ENV') !== 'production') {
      this.logger.log(
        `[dev only] Password reset link for ${email}: ${link} (token for POST /api/auth/reset-password: ${token})`,
      );
    }
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
