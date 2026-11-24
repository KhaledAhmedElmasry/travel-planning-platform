import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'crypto';
import { Model, Types } from 'mongoose';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { EmailToken, EmailTokenPurpose } from './schemas/email-token.schema';

// A verification link works for 24 hours, once.
export const VERIFY_EMAIL_TTL_MS = 24 * 60 * 60 * 1000;
export const INVALID_TOKEN = 'The token is invalid, expired or already used.';

// BONUS (optional): implement only after all mandatory requirements are done (PDF section 12).
// Area: Auth & Accounts (bonus)
// Requirements: ACC-02 (depends on GEN-01-B for the email itself)
//
// The link is sent with MailService (GEN-01-B). When SMTP is not configured nothing is sent, so in
// development (never in production, ACC-19) the link is also written to the server log, which lets
// Swagger be used without an email account.
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    @InjectModel(EmailToken.name)
    private readonly tokenModel: Model<EmailToken>,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
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

  // The link opens the frontend page /verify-email (P-08), which calls GET /api/auth/verify-email
  // and shows the result; same base URL as the ACC-07 reset link (password-reset.service.ts).
  private linkFor(token: string): string {
    const frontend =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
    return `${frontend}/verify-email?token=${token}`;
  }

  private sendLink(email: string, link: string): void {
    // A failed email never undoes the registration: MailService swallows its own errors.
    void this.mail.sendMail({
      to: email,
      subject: 'Verify your email address',
      text: `Welcome! Open this link within 24 hours to verify your email address and start booking:\n\n${link}\n\nIf you did not create an account, ignore this email.`,
    });
    if (this.config.get<string>('NODE_ENV') !== 'production') {
      this.logger.log(`[dev only] Verification link for ${email}: ${link}`);
    }
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
