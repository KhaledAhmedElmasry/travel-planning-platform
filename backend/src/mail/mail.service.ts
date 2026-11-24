import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// BONUS (optional): implement only after all mandatory requirements are done (PDF section 12).
// Area: Community & Cross-cutting (bonus)
// Requirements: GEN-01-B (also used by ACC-02 and ACC-07)
// Sends emails over SMTP, using a test inbox in development: the GEN-01 notifications,
// moderator invitations, email verification links and password reset links.

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly fromAddress: string;
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT') ?? 587;
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASSWORD');
    this.fromAddress =
      this.configService.get<string>('MAIL_FROM') ??
      'Travel Platform <no-reply@travelplatform.local>';

    // Graceful degradation: skip sending when SMTP is not configured.
    // This keeps development running without an email service.
    this.isConfigured = Boolean(host && user && pass);

    if (this.isConfigured) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        // A mail server that does not answer must not hold anything up for long.
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
      });
      this.logger.log(`MailService ready (SMTP: ${host}:${port})`);
    } else {
      this.transporter = null;
      this.logger.warn(
        'SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASSWORD are empty). ' +
          'Email sending is disabled. Set them in .env to enable (GEN-01-B).',
      );
    }
  }

  // ─── Generic send ────────────────────────────────────────────────────────────

  /**
   * Sends a plain-text + HTML email. Swallows errors so a failed email never
   * blocks the primary action (same pattern as NotificationsService.notify).
   */
  async sendMail(opts: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      this.logger.debug(
        `Email not sent (SMTP disabled): ${opts.subject} → ${opts.to}`,
      );
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html ?? this.textToHtml(opts.text),
      });
      this.logger.debug(`Email sent: "${opts.subject}" → ${opts.to}`);
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        this.logger.log(`Preview test email: ${previewUrl}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send email "${opts.subject}" to ${opts.to}`,
        error,
      );
    }
  }

  // ─── GEN-01-B: Mirror in-app notifications by email ──────────────────────────

  /**
   * Sends a GEN-01 in-app notification to the user's email as well.
   * Called by NotificationsService.notify() after saving the in-app record.
   */
  async sendNotificationEmail(
    to: string,
    title: string,
    message: string,
    link?: string | null,
  ): Promise<void> {
    const linkLine = link ? `\n\nView: ${link}` : '';
    const linkHtml = link ? `<p><a href="${link}">View details</a></p>` : '';

    await this.sendMail({
      to,
      subject: `[Travel Platform] ${title}`,
      text: `${message}${linkLine}\n\nYou are receiving this email because you have an account on Travel Platform.`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#1a73e8">${this.escapeHtml(title)}</h2>
          <p>${this.escapeHtml(message)}</p>
          ${linkHtml}
          <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0"/>
          <p style="color:#757575;font-size:12px">
            You are receiving this email because you have an account on Travel Platform.
          </p>
        </div>
      `,
    });
  }

  // ─── ACC-13: Moderator invitation email ──────────────────────────────────────

  /**
   * Sends a moderator invitation email when an admin creates a new moderator account.
   * The email contains the temporary password so the moderator can log in and change it.
   */
  async sendModeratorInvitation(opts: {
    to: string;
    name: string;
    role: 'airline_moderator' | 'hotel_moderator';
    providerName: string;
    temporaryPassword: string;
  }): Promise<void> {
    const roleLabel =
      opts.role === 'airline_moderator'
        ? 'Airline Moderator'
        : 'Hotel Moderator';
    const subject = `[Travel Platform] You have been invited as ${roleLabel}`;

    const text =
      `Hello ${opts.name},\n\n` +
      `An administrator has created a moderator account for you on Travel Platform.\n\n` +
      `Role: ${roleLabel}\n` +
      `Provider: ${opts.providerName}\n\n` +
      `Your temporary login credentials:\n` +
      `  Email:    ${opts.to}\n` +
      `  Password: ${opts.temporaryPassword}\n\n` +
      `You will be required to set a new password at your first login.\n\n` +
      `Please keep this information confidential.\n`;

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a73e8">Welcome to Travel Platform</h2>
        <p>Hello <strong>${this.escapeHtml(opts.name)}</strong>,</p>
        <p>An administrator has created a moderator account for you.</p>
        <table style="border-collapse:collapse;margin:16px 0">
          <tr>
            <td style="padding:4px 12px 4px 0;color:#757575">Role</td>
            <td><strong>${this.escapeHtml(roleLabel)}</strong></td>
          </tr>
          <tr>
            <td style="padding:4px 12px 4px 0;color:#757575">Provider</td>
            <td><strong>${this.escapeHtml(opts.providerName)}</strong></td>
          </tr>
        </table>
        <p>Your temporary login credentials:</p>
        <table style="border-collapse:collapse;background:#f5f5f5;padding:12px;border-radius:4px">
          <tr>
            <td style="padding:4px 12px 4px 0;color:#757575">Email</td>
            <td><code>${this.escapeHtml(opts.to)}</code></td>
          </tr>
          <tr>
            <td style="padding:4px 12px 4px 0;color:#757575">Password</td>
            <td><code>${this.escapeHtml(opts.temporaryPassword)}</code></td>
          </tr>
        </table>
        <p style="color:#d32f2f;margin-top:12px">
          You will be required to set a new password at your first login.
          Please keep this information confidential.
        </p>
        <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0"/>
        <p style="color:#757575;font-size:12px">Travel Platform — do not reply to this email.</p>
      </div>
    `;

    await this.sendMail({ to: opts.to, subject, text, html });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  private textToHtml(text: string): string {
    return `<div style="font-family:sans-serif;white-space:pre-wrap">${this.escapeHtml(text)}</div>`;
  }
}
