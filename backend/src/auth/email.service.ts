import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Sends transactional email (verification codes, password resets) over Gmail
 * SMTP — free for low volume, no paid provider needed.
 *
 * Configure with a Gmail account and an App Password (Google account →
 * Security → 2-Step Verification → App passwords):
 *   GMAIL_USER=you@gmail.com
 *   GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
 *   MAIL_FROM="BookAm <you@gmail.com>"   # optional, defaults to GMAIL_USER
 *
 * With no credentials set, mail is logged to the console instead of sent, so
 * the whole flow is testable in dev without an inbox.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  private get from(): string {
    return (
      process.env.MAIL_FROM ??
      (process.env.GMAIL_USER ? `BookAm <${process.env.GMAIL_USER}>` : 'BookAm')
    );
  }

  /** Lazily builds the SMTP transport once credentials are present. */
  private getTransporter(): Transporter | null {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) return null;
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      });
    }
    return this.transporter;
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    const transporter = this.getTransporter();
    if (!transporter) {
      // Dev fallback: no SMTP configured, so surface the mail in the logs.
      this.logger.log(`[email:dev] To ${to} — ${subject}\n${text}`);
      return;
    }
    await transporter.sendMail({ from: this.from, to, subject, text });
  }

  /** Convenience: the one email BookAm sends most — a 6-digit code. */
  async sendCode(to: string, code: string, purpose: string): Promise<void> {
    await this.send(
      to,
      `Your BookAm ${purpose} code`,
      `Your BookAm ${purpose} code is ${code}. It expires in 10 minutes.\n\n` +
        `If you didn't request this, you can ignore this email.`,
    );
  }
}
