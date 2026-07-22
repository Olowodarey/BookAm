import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { OtpService } from './otp.service';
import { EmailOtpService } from './email-otp.service';
import { AuthService, toSafeUser } from './auth.service';

/** Builds a fully-populated User row; override just the fields a test cares about. */
function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'ada@example.com',
    name: 'Ada',
    role: 'MEMBER',
    status: 'ACTIVE',
    passwordHash: null,
    emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    googleId: null,
    phone: null,
    phoneVerifiedAt: null,
    altPhone: null,
    bankName: null,
    bankAccountNumber: null,
    bankAccountName: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    membership: { updateMany: jest.Mock };
  };
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let otp: { send: jest.Mock; verify: jest.Mock };
  let emailOtp: { send: jest.Mock; verify: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      membership: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    jwt = {
      signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
      verifyAsync: jest.fn(),
    };
    otp = {
      send: jest.fn().mockResolvedValue({ resendAfterSeconds: 60 }),
      verify: jest.fn().mockResolvedValue(undefined),
    };
    emailOtp = {
      send: jest.fn().mockResolvedValue({ resendAfterSeconds: 60 }),
      verify: jest.fn().mockResolvedValue(undefined),
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      otp as unknown as OtpService,
      emailOtp as unknown as EmailOtpService,
    );
  });

  describe('toSafeUser', () => {
    it('never leaks the password hash', () => {
      const safe = toSafeUser(makeUser({ passwordHash: 'secret-hash' }));
      expect(safe).not.toHaveProperty('passwordHash');
      expect(safe).not.toHaveProperty('googleId');
      expect(safe.email).toBe('ada@example.com');
    });
  });

  describe('login', () => {
    it('issues a session for a correct password on a verified account', async () => {
      const passwordHash = await bcrypt.hash('hunter2', 10);
      prisma.user.findUnique.mockResolvedValue(makeUser({ passwordHash }));

      const result = await service.login('ada@example.com', 'hunter2');

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user.email).toBe('ada@example.com');
      expect(jwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-1', email: 'ada@example.com' }),
      );
    });

    it('normalizes the email before lookup', async () => {
      const passwordHash = await bcrypt.hash('hunter2', 10);
      prisma.user.findUnique.mockResolvedValue(makeUser({ passwordHash }));

      await service.login('  Ada@Example.com ', 'hunter2');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'ada@example.com' },
      });
    });

    it('rejects an unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login('nobody@example.com', 'x'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a Google-only account with no password', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ passwordHash: null }),
      );
      await expect(
        service.login('ada@example.com', 'anything'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a wrong password', async () => {
      const passwordHash = await bcrypt.hash('correct', 10);
      prisma.user.findUnique.mockResolvedValue(makeUser({ passwordHash }));
      await expect(
        service.login('ada@example.com', 'wrong'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('blocks a suspended account even with the right password', async () => {
      const passwordHash = await bcrypt.hash('hunter2', 10);
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ passwordHash, status: 'SUSPENDED' }),
      );
      await expect(
        service.login('ada@example.com', 'hunter2'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('nudges an unverified email into verification', async () => {
      const passwordHash = await bcrypt.hash('hunter2', 10);
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ passwordHash, emailVerifiedAt: null }),
      );
      emailOtp.send.mockResolvedValue({
        resendAfterSeconds: 60,
        devCode: '123456',
      });

      await expect(
        service.login('ada@example.com', 'hunter2'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'EMAIL_NOT_VERIFIED' }),
      });
      expect(emailOtp.send).toHaveBeenCalledWith('ada@example.com');
    });
  });

  describe('register', () => {
    it('creates a MEMBER and emails a code for a brand-new email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(makeUser());

      const result = await service.register(
        'Ada',
        'ada@example.com',
        'pw12345',
      );

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'ada@example.com',
          name: 'Ada',
          role: 'MEMBER',
        }),
      });
      expect(emailOtp.send).toHaveBeenCalledWith('ada@example.com');
      expect(result).toMatchObject({ requiresVerification: true });
    });

    it('hashes the password rather than storing it in the clear', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(makeUser());

      await service.register('Ada', 'ada@example.com', 'pw12345');

      const { passwordHash } = prisma.user.create.mock.calls[0][0].data;
      expect(passwordHash).not.toBe('pw12345');
      expect(await bcrypt.compare('pw12345', passwordHash)).toBe(true);
    });

    it('refreshes an unfinished sign-up instead of creating a duplicate', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ emailVerifiedAt: null }),
      );
      prisma.user.update.mockResolvedValue(makeUser());

      await service.register('New Name', 'ada@example.com', 'pw12345');

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ name: 'New Name' }),
        }),
      );
    });

    it('rejects an email that already has a verified account', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ emailVerifiedAt: new Date() }),
      );
      await expect(
        service.register('Ada', 'ada@example.com', 'pw12345'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(emailOtp.send).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('verifies the email and issues a session', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ emailVerifiedAt: null }),
      );
      prisma.user.update.mockResolvedValue(makeUser());

      const result = await service.verifyEmail('ada@example.com', '123456');

      expect(emailOtp.verify).toHaveBeenCalledWith('ada@example.com', '123456');
      expect(result.accessToken).toBe('signed.jwt.token');
    });

    it('propagates an invalid code without touching the user', async () => {
      emailOtp.verify.mockRejectedValue(
        new BadRequestException('Incorrect code'),
      );
      await expect(
        service.verifyEmail('ada@example.com', '000000'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects when there is no sign-up for the email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.verifyEmail('ada@example.com', '123456'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('blocks a suspended account after a valid code', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      prisma.user.update.mockResolvedValue(makeUser({ status: 'SUSPENDED' }));
      await expect(
        service.verifyEmail('ada@example.com', '123456'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('googleSignIn', () => {
    const OLD_ENV = process.env.GOOGLE_CLIENT_ID;
    const fetchMock = jest.fn();

    beforeAll(() => {
      global.fetch = fetchMock;
    });
    beforeEach(() => {
      process.env.GOOGLE_CLIENT_ID = 'client-123';
      fetchMock.mockReset();
    });
    afterAll(() => {
      process.env.GOOGLE_CLIENT_ID = OLD_ENV;
    });

    const goodToken = {
      aud: 'client-123',
      sub: 'g-123',
      email: 'ada@example.com',
      email_verified: 'true',
      name: 'Ada',
    };
    const okResponse = (body: unknown) => ({
      ok: true,
      json: () => Promise.resolve(body),
    });

    it('fails when Google sign-in is not configured', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      await expect(service.googleSignIn('tok')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('rejects a token whose audience is not our client', async () => {
      fetchMock.mockResolvedValue(
        okResponse({ ...goodToken, aud: 'someone-else' }),
      );
      await expect(service.googleSignIn('tok')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a token Google will not vouch for', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 400 });
      await expect(service.googleSignIn('tok')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('signs in an existing account matched by googleId', async () => {
      fetchMock.mockResolvedValue(okResponse(goodToken));
      prisma.user.findUnique.mockResolvedValueOnce(
        makeUser({ googleId: 'g-123' }),
      );

      const result = await service.googleSignIn('tok');

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('links Google onto an existing same-email account', async () => {
      fetchMock.mockResolvedValue(okResponse(goodToken));
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // by googleId
        .mockResolvedValueOnce(makeUser({ googleId: null })); // by email
      prisma.user.update.mockResolvedValue(makeUser({ googleId: 'g-123' }));

      const result = await service.googleSignIn('tok');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ googleId: 'g-123' }),
        }),
      );
      expect(result.accessToken).toBe('signed.jwt.token');
    });

    it('creates a fresh verified account on first Google sign-in', async () => {
      fetchMock.mockResolvedValue(okResponse(goodToken));
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(makeUser({ googleId: 'g-123' }));

      const result = await service.googleSignIn('tok');

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'ada@example.com',
            googleId: 'g-123',
            role: 'MEMBER',
          }),
        }),
      );
      expect(result.accessToken).toBe('signed.jwt.token');
    });

    it('blocks a suspended account signing in with Google', async () => {
      fetchMock.mockResolvedValue(okResponse(goodToken));
      prisma.user.findUnique.mockResolvedValueOnce(
        makeUser({ googleId: 'g-123', status: 'SUSPENDED' }),
      );
      await expect(service.googleSignIn('tok')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('changePassword', () => {
    it('changes the password when the current one is correct', async () => {
      const passwordHash = await bcrypt.hash('oldpass', 10);
      prisma.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ passwordHash }),
      );
      prisma.user.update.mockResolvedValue(makeUser());

      const result = await service.changePassword(
        'user-1',
        'oldpass',
        'newpass1',
      );

      expect(result).toEqual({ changed: true });
      const updated = prisma.user.update.mock.calls[0][0].data.passwordHash;
      expect(await bcrypt.compare('newpass1', updated)).toBe(true);
    });

    it('rejects a wrong current password', async () => {
      const passwordHash = await bcrypt.hash('oldpass', 10);
      prisma.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ passwordHash }),
      );
      await expect(
        service.changePassword('user-1', 'wrong', 'newpass1'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword / resetPassword', () => {
    it('emails a code for a known account', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      const result = await service.forgotPassword('ada@example.com');
      expect(emailOtp.send).toHaveBeenCalledWith(
        'ada@example.com',
        'password reset',
      );
      expect(result.requiresVerification).toBe(true);
    });

    it('rejects forgot-password for an unknown account', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.forgotPassword('nobody@example.com'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(emailOtp.send).not.toHaveBeenCalled();
    });

    it('resets the password and signs the user in after a valid code', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ emailVerifiedAt: null }),
      );
      prisma.user.update.mockResolvedValue(makeUser());

      const result = await service.resetPassword(
        'ada@example.com',
        '123456',
        'brandnew1',
      );

      expect(emailOtp.verify).toHaveBeenCalledWith('ada@example.com', '123456');
      const updated = prisma.user.update.mock.calls[0][0].data.passwordHash;
      expect(await bcrypt.compare('brandnew1', updated)).toBe(true);
      expect(result.accessToken).toBe('signed.jwt.token');
    });

    it('rejects reset when the account disappeared', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.resetPassword('ada@example.com', '123456', 'brandnew1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('phone verification (optional, in-app)', () => {
    it('sends an OTP for a phone no one else owns', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.sendPhoneOtp('user-1', '+2348010000000');
      expect(otp.send).toHaveBeenCalledWith('+2348010000000');
      expect(result.requiresVerification).toBe(true);
    });

    it('refuses to send an OTP for a phone another account owns', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ id: 'someone-else' }),
      );
      await expect(
        service.sendPhoneOtp('user-1', '+2348010000000'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(otp.send).not.toHaveBeenCalled();
    });

    it('verifies the phone, sets it, and claims memberships', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.update.mockResolvedValue(
        makeUser({ phone: '+2348010000000', phoneVerifiedAt: new Date() }),
      );

      const result = await service.verifyPhone(
        'user-1',
        '+2348010000000',
        '123456',
      );

      expect(otp.verify).toHaveBeenCalledWith('+2348010000000', '123456');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ phone: '+2348010000000' }),
        }),
      );
      expect(prisma.membership.updateMany).toHaveBeenCalledWith({
        where: { phone: '+2348010000000', userId: null },
        data: { userId: 'user-1' },
      });
      expect(result.phone).toBe('+2348010000000');
    });

    it('refuses to verify a phone another account already owns', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ id: 'someone-else' }),
      );
      await expect(
        service.verifyPhone('user-1', '+2348010000000', '123456'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
