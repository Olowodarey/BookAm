import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

export interface EmailOtpSendResult {
  resendAfterSeconds: number;
  /** Only outside production, so the flow is testable without an inbox. */
  devCode?: string;
}

/**
 * One-time codes emailed to prove a person owns their email address — the
 * primary identity in BookAm. Codes are stored hashed and expire after 10
 * minutes. Mirrors OtpService (phone) but delivers over email.
 */
@Injectable()
export class EmailOtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async send(
    email: string,
    purpose = 'verification',
  ): Promise<EmailOtpSendResult> {
    const latest = await this.prisma.emailOtp.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });
    if (latest) {
      const since = Date.now() - latest.createdAt.getTime();
      if (since < RESEND_COOLDOWN_MS) {
        throw new HttpException(
          `Please wait ${Math.ceil((RESEND_COOLDOWN_MS - since) / 1000)}s before requesting another code`,
          429,
        );
      }
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.emailOtp.create({
      data: {
        email,
        codeHash: await bcrypt.hash(code, 10),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    await this.email.sendCode(
      email,
      code,
      purpose,
      this.link(purpose, email, code),
    );
    return {
      resendAfterSeconds: RESEND_COOLDOWN_MS / 1000,
      ...(process.env.NODE_ENV !== 'production' ? { devCode: code } : {}),
    };
  }

  /**
   * A one-click link carrying the same code, so people can verify from the
   * email without typing. Verification lands on /verify-email (which signs them
   * in); a reset lands on /forgot-password with the code pre-filled.
   */
  private link(purpose: string, email: string, code: string): string {
    const base = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const q = `email=${encodeURIComponent(email)}&code=${code}`;
    const path =
      purpose === 'password reset' ? '/forgot-password' : '/verify-email';
    return `${base}${path}?${q}`;
  }

  /** Consumes the latest valid code for the email or throws a 400. */
  async verify(email: string, code: string): Promise<void> {
    const otp = await this.prisma.emailOtp.findFirst({
      where: { email, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException(
        'This code has expired — request a new one',
      );
    }
    if (otp.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException(
        'Too many wrong tries — request a new code',
      );
    }
    const ok = await bcrypt.compare(code, otp.codeHash);
    if (!ok) {
      await this.prisma.emailOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Incorrect code — check and try again');
    }
    await this.prisma.emailOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
  }
}
