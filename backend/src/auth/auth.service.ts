import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { OtpService } from './otp.service';
import type {
  GoogleLinkPayload,
  GoogleSignInResponse,
  JwtPayload,
  LoginResponse,
  OtpSentResponse,
  SafeUser,
} from './auth.types';

export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
    status: user.status,
    email: user.email,
    altPhone: user.altPhone,
    bankName: user.bankName,
    bankAccountNumber: user.bankAccountNumber,
    bankAccountName: user.bankAccountName,
    createdAt: user.createdAt,
  };
}

/** Shape of Google's tokeninfo response for an ID token. */
interface GoogleTokenInfo {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string;
  name?: string;
  exp?: string;
}

/**
 * Everyone registers as a contributor (MEMBER). Becoming a collector goes
 * through a CollectorApplication that the platform admin approves. The phone
 * number is the primary identity — it must be OTP-verified because it is how
 * accounts match the memberships coordinators create from their WhatsApp
 * groups. Google sign-in is a convenience credential on top: a Google account
 * still has to link and verify a phone before it can do anything.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly otp: OtpService,
  ) {}

  async login(phone: string, password: string): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid phone number or password');
    }
    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid phone number or password');
    }
    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException('This account is suspended');
    }
    if (!user.phoneVerifiedAt) {
      // Password was correct — nudge them straight into verification.
      const sent = await this.otp.send(user.phone).catch(() => null);
      throw new ForbiddenException({
        message: 'Verify your phone number to continue',
        code: 'PHONE_NOT_VERIFIED',
        phone: user.phone,
        ...(sent?.devCode ? { devCode: sent.devCode } : {}),
      });
    }
    return this.issueSession(user);
  }

  /** Step 1 of sign-up: create the MEMBER account and send the OTP. */
  async register(
    name: string,
    phone: string,
    password: string,
  ): Promise<OtpSentResponse> {
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing?.phoneVerifiedAt) {
      throw new ConflictException(
        'This phone number already has an account — sign in instead',
      );
    }
    const passwordHash = await bcrypt.hash(password, 10);
    if (existing) {
      // Unfinished sign-up: refresh the details and resend the code.
      await this.prisma.user.update({
        where: { id: existing.id },
        data: { name, passwordHash },
      });
    } else {
      await this.prisma.user.create({
        data: { phone, name, passwordHash, role: 'MEMBER' },
      });
    }
    const sent = await this.otp.send(phone);
    return { phone, requiresVerification: true, ...sent };
  }

  /**
   * Step 2: the OTP proves phone ownership. Completes password sign-ups and
   * Google link-ups alike, then claims any circle memberships a coordinator
   * already created for this phone number.
   */
  async verifyPhone(
    phone: string,
    code: string,
    linkToken?: string,
  ): Promise<LoginResponse> {
    await this.otp.verify(phone, code);

    let user: User;
    if (linkToken) {
      const link = await this.readLinkToken(linkToken);
      const existing = await this.prisma.user.findUnique({ where: { phone } });
      if (existing) {
        if (existing.googleId && existing.googleId !== link.googleId) {
          throw new ConflictException(
            'This phone number is already linked to a different Google account',
          );
        }
        user = await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            googleId: link.googleId,
            email: link.email,
            phoneVerifiedAt: existing.phoneVerifiedAt ?? new Date(),
          },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            phone,
            name: link.name,
            email: link.email,
            googleId: link.googleId,
            role: 'MEMBER',
            phoneVerifiedAt: new Date(),
          },
        });
      }
    } else {
      const existing = await this.prisma.user.findUnique({ where: { phone } });
      if (!existing) {
        throw new BadRequestException('No sign-up found for this phone number');
      }
      user = await this.prisma.user.update({
        where: { id: existing.id },
        data: { phoneVerifiedAt: existing.phoneVerifiedAt ?? new Date() },
      });
    }

    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException('This account is suspended');
    }
    await this.claimMemberships(user);
    return this.issueSession(user);
  }

  async resendOtp(phone: string): Promise<OtpSentResponse> {
    // Deliberately quiet about whether an account exists; the cooldown in
    // OtpService keeps this from being used as a spam channel.
    const sent = await this.otp.send(phone);
    return { phone, requiresVerification: true, ...sent };
  }

  /**
   * Google Identity Services hands the client an ID token; we validate it
   * against Google and either sign the user in or ask for a phone to link.
   * No SDK needed — Google's tokeninfo endpoint does the verification.
   */
  async googleSignIn(idToken: string): Promise<GoogleSignInResponse> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new ServiceUnavailableException(
        'Google sign-in is not configured (set GOOGLE_CLIENT_ID)',
      );
    }

    let info: GoogleTokenInfo;
    try {
      const res = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      );
      if (!res.ok) throw new Error(`tokeninfo ${res.status}`);
      info = (await res.json()) as GoogleTokenInfo;
    } catch {
      throw new UnauthorizedException('Google sign-in could not be verified');
    }
    if (
      info.aud !== clientId ||
      !info.sub ||
      !info.email ||
      info.email_verified !== 'true'
    ) {
      throw new UnauthorizedException('Google sign-in could not be verified');
    }

    const user =
      (await this.prisma.user.findUnique({
        where: { googleId: info.sub },
      })) ??
      (await this.prisma.user.findUnique({ where: { email: info.email } }));

    if (user) {
      if (user.status === 'SUSPENDED') {
        throw new ForbiddenException('This account is suspended');
      }
      if (user.phoneVerifiedAt) {
        if (!user.googleId) {
          await this.prisma.user.update({
            where: { id: user.id },
            data: { googleId: info.sub },
          });
        }
        return { status: 'SIGNED_IN', session: await this.issueSession(user) };
      }
    }

    // New to BookAm (or phone never verified): collect + verify a phone so
    // the account ties into their WhatsApp-group circles.
    const payload: GoogleLinkPayload = {
      purpose: 'google-link',
      googleId: info.sub,
      email: info.email,
      name: info.name ?? info.email.split('@')[0],
    };
    return {
      status: 'NEEDS_PHONE',
      linkToken: await this.jwt.signAsync(payload, { expiresIn: '15m' }),
      name: payload.name,
      email: payload.email,
    };
  }

  /** Sends the OTP for the phone a Google user wants to link. */
  async linkPhone(linkToken: string, phone: string): Promise<OtpSentResponse> {
    const link = await this.readLinkToken(linkToken);
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing?.googleId && existing.googleId !== link.googleId) {
      throw new ConflictException(
        'This phone number is already linked to a different Google account',
      );
    }
    const sent = await this.otp.send(phone);
    return { phone, requiresVerification: true, ...sent };
  }

  // ---- Settings ------------------------------------------------------------

  /** Empty string clears a nullable profile field; undefined leaves it. */
  private static clearable(value: string | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    return value.trim() === '' ? null : value.trim();
  }

  async updateProfile(
    userId: string,
    dto: {
      name?: string;
      altPhone?: string;
      bankName?: string;
      bankAccountNumber?: string;
      bankAccountName?: string;
    },
  ): Promise<SafeUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.altPhone !== undefined
          ? { altPhone: AuthService.clearable(dto.altPhone) }
          : {}),
        ...(dto.bankName !== undefined
          ? { bankName: AuthService.clearable(dto.bankName) }
          : {}),
        ...(dto.bankAccountNumber !== undefined
          ? { bankAccountNumber: AuthService.clearable(dto.bankAccountNumber) }
          : {}),
        ...(dto.bankAccountName !== undefined
          ? { bankAccountName: AuthService.clearable(dto.bankAccountName) }
          : {}),
      },
    });
    return toSafeUser(user);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ changed: true }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (
      !user.passwordHash ||
      !(await bcrypt.compare(currentPassword, user.passwordHash))
    ) {
      throw new UnauthorizedException('Current password is not correct');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    return { changed: true };
  }

  // ---- Forgot password -----------------------------------------------------

  /** Sends an OTP so the owner of the phone can set a new password. */
  async forgotPassword(phone: string): Promise<OtpSentResponse> {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      throw new BadRequestException(
        'No account with this phone number — create one instead',
      );
    }
    const sent = await this.otp.send(phone);
    return { phone, requiresVerification: true, ...sent };
  }

  /**
   * The OTP proves phone ownership, so this also verifies the phone and
   * signs the user straight in with their new password set.
   */
  async resetPassword(
    phone: string,
    code: string,
    newPassword: string,
  ): Promise<LoginResponse> {
    await this.otp.verify(phone, code);
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (!existing) {
      throw new BadRequestException('No account with this phone number');
    }
    const user = await this.prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 10),
        phoneVerifiedAt: existing.phoneVerifiedAt ?? new Date(),
      },
    });
    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException('This account is suspended');
    }
    await this.claimMemberships(user);
    return this.issueSession(user);
  }

  /**
   * Coordinators add members to circles by phone before those people have
   * accounts; once the phone is verified, those memberships become theirs.
   */
  private async claimMemberships(user: User): Promise<void> {
    await this.prisma.membership.updateMany({
      where: { phone: user.phone, userId: null },
      data: { userId: user.id },
    });
  }

  private async readLinkToken(token: string): Promise<GoogleLinkPayload> {
    try {
      const payload = await this.jwt.verifyAsync<GoogleLinkPayload>(token);
      if (payload.purpose !== 'google-link') throw new Error('wrong purpose');
      return payload;
    } catch {
      throw new UnauthorizedException(
        'This Google sign-in expired — please try again',
      );
    }
  }

  private async issueSession(user: User): Promise<LoginResponse> {
    const payload: JwtPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
    };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: toSafeUser(user),
    };
  }
}
