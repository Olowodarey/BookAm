import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Sends transactional email (verification codes, password resets). Delivery is
 * chosen at runtime, best option first:
 *
 *   1. Resend HTTP API (RESEND_API_KEY) — sends over HTTPS, so it works even
 *      where outbound SMTP is blocked (e.g. Railway). This is production.
 *        RESEND_API_KEY=re_xxx
 *        MAIL_FROM="BookAm <no-reply@bookam.xyz>"   # must be a Resend-verified
 *                                                     domain (gmail.com won't do)
 *   2. Gmail SMTP (GMAIL_USER + GMAIL_APP_PASSWORD) — handy locally; blocked on
 *      Railway, so not used in production there.
 *   3. No config → mail is logged to the console, so the flow is testable in
 *      dev without an inbox (the OTP is also returned as devCode outside prod).
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
        host: 'smtp.gmail.com',
        // Port 587 (STARTTLS) rather than 465 (SMTPS): some hosts (Railway)
        // filter 465 outbound, and 587 is the standard submission port.
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user, pass },
        // Railway can't route IPv6 egress (main.ts forces ipv4first DNS order to
        // dodge that) — fail fast here instead of hanging if a connection stalls.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
      });
    }
    return this.transporter;
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    // 1. Resend over HTTPS — the production path (Railway blocks SMTP egress).
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      await this.sendViaResend(resendKey, to, subject, text);
      return;
    }
    // 2. Gmail SMTP — works locally.
    const transporter = this.getTransporter();
    if (transporter) {
      await transporter.sendMail({ from: this.from, to, subject, text });
      return;
    }
    // 3. Dev fallback: nothing configured, so surface the mail in the logs.
    this.logger.log(`[email:dev] To ${to} — ${subject}\n${text}`);
  }

  /** Sends via Resend's REST API — no SDK, just an HTTPS POST. */
  private async sendViaResend(
    apiKey: string,
    to: string,
    subject: string,
    text: string,
  ): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.from, to, subject, text }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Resend send failed (${res.status}): ${detail}`);
    }
  }

  /**
   * The one email BookAm sends most — a 6-digit code, plus an optional
   * one-click link that carries the same code so people can verify without
   * typing anything.
   */
  async sendCode(
    to: string,
    code: string,
    purpose: string,
    link?: string,
  ): Promise<void> {
    const linkLine = link
      ? `\nOr just click this link to ${purpose === 'password reset' ? 'reset your password' : 'confirm your email'}:\n${link}\n`
      : '';
    await this.send(
      to,
      `Your BookAm ${purpose} code`,
      `Your BookAm ${purpose} code is ${code}. It expires in 10 minutes.\n` +
        linkLine +
        `\nIf you didn't request this, you can ignore this email.`,
    );
  }
}
