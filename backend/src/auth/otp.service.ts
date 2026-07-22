import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from './whatsapp.service';

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

export interface OtpSendResult {
  resendAfterSeconds: number;
  /** Only outside production, so the flow is testable without a provider. */
  devCode?: string;
}

/**
 * One-time codes proving a person owns their phone number — the number that
 * ties their account to the WhatsApp-group circle they already belong to.
 * Codes are stored hashed and expire after 10 minutes.
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  async send(phone: string): Promise<OtpSendResult> {
    const latest = await this.prisma.phoneOtp.findFirst({
      where: { phone },
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
    await this.prisma.phoneOtp.create({
      data: {
        phone,
        codeHash: await bcrypt.hash(code, 10),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    await this.whatsapp.sendCode(phone, code);
    return {
      resendAfterSeconds: RESEND_COOLDOWN_MS / 1000,
      ...(process.env.NODE_ENV !== 'production' ? { devCode: code } : {}),
    };
  }

  /** Consumes the latest valid code for the phone or throws a 400. */
  async verify(phone: string, code: string): Promise<void> {
    const otp = await this.prisma.phoneOtp.findFirst({
      where: { phone, consumedAt: null },
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
      await this.prisma.phoneOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Incorrect code — check and try again');
    }
    await this.prisma.phoneOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
  }
}
