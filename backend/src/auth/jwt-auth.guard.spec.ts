import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard, AuthenticatedRequest } from './jwt-auth.guard';

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

/** ExecutionContext wrapping a request with the given Authorization header. */
function makeContext(authHeader?: string): {
  context: ExecutionContext;
  request: Partial<AuthenticatedRequest>;
} {
  const request: Partial<AuthenticatedRequest> = {
    headers: authHeader ? { authorization: authHeader } : {},
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwt: { verifyAsync: jest.Mock };
  let prisma: { user: { findUnique: jest.Mock } };

  beforeEach(() => {
    jwt = { verifyAsync: jest.fn() };
    prisma = { user: { findUnique: jest.fn() } };
    guard = new JwtAuthGuard(
      jwt as unknown as JwtService,
      prisma as unknown as PrismaService,
    );
  });

  it('rejects a request with no Authorization header', async () => {
    const { context } = makeContext(undefined);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a header that is not a Bearer token', async () => {
    const { context } = makeContext('Basic abc');
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an invalid or expired token', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('expired'));
    const { context } = makeContext('Bearer bad.token');
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token whose user no longer exists', async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: 'ghost',
      phone: '',
      role: 'MEMBER',
    });
    prisma.user.findUnique.mockResolvedValue(null);
    const { context } = makeContext('Bearer good.token');
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('blocks a suspended account even with a valid token', async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      phone: '+2348010000000',
      role: 'MEMBER',
    });
    prisma.user.findUnique.mockResolvedValue(makeUser({ status: 'SUSPENDED' }));
    const { context } = makeContext('Bearer good.token');
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('attaches the safe user to the request for a valid token', async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      phone: '+2348010000000',
      role: 'ADMIN',
    });
    prisma.user.findUnique.mockResolvedValue(
      makeUser({ role: 'ADMIN', passwordHash: 'secret' }),
    );
    const { context, request } = makeContext('Bearer good.token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ id: 'user-1', role: 'ADMIN' });
    expect(request.user).not.toHaveProperty('passwordHash');
  });

  it('reloads the user from the DB so live role changes take effect', async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      phone: '+2348010000000',
      role: 'MEMBER', // stale claim in the token
    });
    prisma.user.findUnique.mockResolvedValue(makeUser({ role: 'COORDINATOR' }));
    const { context, request } = makeContext('Bearer good.token');

    await guard.canActivate(context);
    expect(request.user?.role).toBe('COORDINATOR');
  });
});
