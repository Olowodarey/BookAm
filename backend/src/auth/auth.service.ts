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
import { EmailOtpService } from './email-otp.service';
import type {
  JwtPayload,
  LoginResponse,
  OtpSentResponse,
  SafeUser,
} from './auth.types';

export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    phone: user.phone,
    phoneVerifiedAt: user.phoneVerifiedAt,
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
 * Email is BookAm's primary identity: one email, one account. People sign up
 * with email+password (verified by an emailed code) or with Google (whose
 * email is already verified) — and the two link automatically on the same
 * email. A phone/WhatsApp number is optional and verified in-app later; that
 * is what claims any circle memberships a coordinator added by that number.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly otp: OtpService,
    private readonly emailOtp: EmailOtpService,
  ) {}

  private static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    email = AuthService.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException('This account is suspended');
    }
    if (!user.emailVerifiedAt) {
      // Password was correct — nudge them straight into verification.
      const sent = await this.emailOtp.send(user.email).catch(() => null);
      throw new ForbiddenException({
        message: 'Verify your email to continue',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
        ...(sent?.devCode ? { devCode: sent.devCode } : {}),
      });
    }
    return this.issueSession(user);
  }

  /** Step 1 of email sign-up: create the MEMBER account and email the code. */
  async register(
    name: string,
    email: string,
    password: string,
  ): Promise<OtpSentResponse> {
    email = AuthService.normalizeEmail(email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing?.emailVerifiedAt) {
      // Never set a password on an already-verified account here — that would
      // be account takeover. Google-only users add a password via forgot-password.
      throw new ConflictException(
        'This email already has an account — sign in instead',
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
        data: { email, name, passwordHash, role: 'MEMBER' },
      });
    }
    return { requiresVerification: true, ...(await this.emailOtp.send(email)) };
  }

  /** Step 2: the emailed code proves ownership and activates the account. */
  async verifyEmail(email: string, code: string): Promise<LoginResponse> {
    email = AuthService.normalizeEmail(email);
    await this.emailOtp.verify(email, code);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (!existing) {
      throw new BadRequestException('No sign-up found for this email');
    }
    const user = await this.prisma.user.update({
      where: { id: existing.id },
      data: { emailVerifiedAt: existing.emailVerifiedAt ?? new Date() },
    });
    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException('This account is suspended');
    }
    await this.claimEmailInvites(user);
    return this.issueSession(user);
  }

  async resendEmailOtp(email: string): Promise<OtpSentResponse> {
    // Deliberately quiet about whether an account exists; the cooldown in
    // EmailOtpService keeps this from being used as a spam channel.
    return {
      requiresVerification: true,
      ...(await this.emailOtp.send(AuthService.normalizeEmail(email))),
    };
  }

  /**
   * Google Identity Services hands the client an ID token; we validate it
   * against Google, then sign the user in — creating the account on first
   * sight, or linking to an existing same-email account. Google emails are
   * always verified, so no extra verification step is needed.
   */
  async googleSignIn(idToken: string): Promise<LoginResponse> {
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

    const email = AuthService.normalizeEmail(info.email);
    const existing =
      (await this.prisma.user.findUnique({ where: { googleId: info.sub } })) ??
      (await this.prisma.user.findUnique({ where: { email } }));

    if (existing) {
      if (existing.status === 'SUSPENDED') {
        throw new ForbiddenException('This account is suspended');
      }
      // Link the Google credential and trust the verified email.
      const user =
        existing.googleId && existing.emailVerifiedAt
          ? existing
          : await this.prisma.user.update({
              where: { id: existing.id },
              data: {
                googleId: existing.googleId ?? info.sub,
                emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
              },
            });
      await this.claimEmailInvites(user);
      return this.issueSession(user);
    }

    const created = await this.prisma.user.create({
      data: {
        email,
        name: info.name ?? email.split('@')[0],
        googleId: info.sub,
        role: 'MEMBER',
        emailVerifiedAt: new Date(),
      },
    });
    await this.claimEmailInvites(created);
    return this.issueSession(created);
  }

  // ---- Settings ------------------------------------------------------------

  /** Empty string clears a nullable profile field; undefined leaves it. */
  private static clearable(
    value: string | undefined,
  ): string | null | undefined {
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

  /** Emails a code so the owner can set a new password (also adds a password
   *  to a Google-only account, since the code proves email ownership). */
  async forgotPassword(email: string): Promise<OtpSentResponse> {
    email = AuthService.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException(
        'No account with this email — create one instead',
      );
    }
    return {
      requiresVerification: true,
      ...(await this.emailOtp.send(email, 'password reset')),
    };
  }

  /**
   * The emailed code proves ownership, so this also verifies the email and
   * signs the user straight in with their new password set.
   */
  async resetPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<LoginResponse> {
    email = AuthService.normalizeEmail(email);
    await this.emailOtp.verify(email, code);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (!existing) {
      throw new BadRequestException('No account with this email');
    }
    const user = await this.prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 10),
        emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
      },
    });
    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException('This account is suspended');
    }
    return this.issueSession(user);
  }

  // ---- Optional phone verification (in-app) --------------------------------

  /** Sends an OTP to the WhatsApp/phone number the signed-in user wants to add. */
  async sendPhoneOtp(userId: string, phone: string): Promise<OtpSentResponse> {
    const owner = await this.prisma.user.findUnique({ where: { phone } });
    if (owner && owner.id !== userId) {
      throw new ConflictException(
        'This phone number is already linked to another account',
      );
    }
    return { requiresVerification: true, ...(await this.otp.send(phone)) };
  }

  /**
   * Confirms the phone belongs to the signed-in user, then claims any circle
   * memberships a coordinator already created for that number.
   */
  async verifyPhone(
    userId: string,
    phone: string,
    code: string,
  ): Promise<SafeUser> {
    await this.otp.verify(phone, code);
    const owner = await this.prisma.user.findUnique({ where: { phone } });
    if (owner && owner.id !== userId) {
      throw new ConflictException(
        'This phone number is already linked to another account',
      );
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { phone, phoneVerifiedAt: new Date() },
    });
    await this.claimMemberships(user);
    return toSafeUser(user);
  }

  /**
   * Coordinators add members to circles by phone before those people have
   * accounts; once the phone is verified, those memberships become theirs.
   */
  private async claimMemberships(user: User): Promise<void> {
    if (!user.phone) return;
    await this.prisma.membership.updateMany({
      where: { phone: user.phone, userId: null },
      data: { userId: user.id },
    });
  }

  /**
   * Coordinators can invite a Gmail before it has an account. Once someone owns
   * that Gmail (verified sign-up or Google sign-in), those INVITED memberships
   * become theirs — they then show up under "Circle invites" to accept.
   */
  private async claimEmailInvites(user: User): Promise<void> {
    await this.prisma.membership.updateMany({
      where: { invitedEmail: user.email, userId: null, status: 'INVITED' },
      data: { userId: user.id, name: user.name },
    });
  }

  private async issueSession(user: User): Promise<LoginResponse> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: toSafeUser(user),
    };
  }
}
