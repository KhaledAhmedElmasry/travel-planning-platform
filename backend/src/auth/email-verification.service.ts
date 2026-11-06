import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'crypto';
import { Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import { EmailToken, EmailTokenPurpose } from './schemas/email-token.schema';

// A verification link works for 24 hours, once.
export const VERIFY_EMAIL_TTL_MS = 24 * 60 * 60 * 1000;
export const INVALID_TOKEN = 'The token is invalid, expired or already used.';

// BONUS (optional): implement only after all mandatory requirements are done (PDF section 12).
// Area: Auth & Accounts (bonus)
// Requirements: ACC-02 (depends on GEN-01-B for the email itself)
//
// WAITING FOR (GEN-01-B): MailService is still empty. Until it can send email, the link is written
// to the server log in development only (never in production, ACC-19). Then replace the body of
// sendLink() with one MailService call; nothing else changes.
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    @InjectModel(EmailToken.name)
    private readonly tokenModel: Model<EmailToken>,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  // ACC-02: after registration, create a one-time link and send it to the new account.
  async sendVerification(userId: Types.ObjectId, email: string): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    await this.tokenModel.create({
      userId,
      tokenHash: hashToken(token),
      purpose: EmailTokenPurpose.VerifyEmail,
      expiresAt: new Date(Date.now() + VERIFY_EMAIL_TTL_MS),
    });
    this.sendLink(email, this.linkFor(token));
  }

  // ACC-02: GET /api/auth/verify-email. The token is marked used in the same atomic update that
  // finds it, so a link can never be used twice, even by two clicks at the same moment.
  async verify(token: string): Promise<void> {
    if (!token) throw new BadRequestException(INVALID_TOKEN);
    const used = await this.tokenModel
      .findOneAndUpdate(
        {
          tokenHash: hashToken(token),
          purpose: EmailTokenPurpose.VerifyEmail,
          usedAt: null,
          expiresAt: { $gt: new Date() },
        },
        { $set: { usedAt: new Date() } },
        { new: true },
      )
      .exec();
    if (!used) throw new BadRequestException(INVALID_TOKEN);
    await this.usersService.markEmailVerified(used.userId);
  }

  private linkFor(token: string): string {
    const port = this.config.get<string>('PORT') ?? '3000';
    const base =
      this.config.get<string>('API_URL') ?? `http://localhost:${port}`;
    return `${base}/api/auth/verify-email?token=${token}`;
  }

  private sendLink(email: string, link: string): void {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      this.logger.warn(
        `Email sending is not set up yet (GEN-01-B); no link sent to ${email}`,
      );
      return;
    }
    this.logger.log(`[dev only] Verification link for ${email}: ${link}`);
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
