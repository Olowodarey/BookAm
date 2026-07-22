import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';
import type { SafeUser } from './auth.types';
import { RolesGuard } from './roles';

function makeSafeUser(role: Role): SafeUser {
  return {
    id: 'user-1',
    email: 'ada@example.com',
    name: 'Ada',
    role,
    status: 'ACTIVE',
    emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    phone: null,
    phoneVerifiedAt: null,
    altPhone: null,
    bankName: null,
    bankAccountNumber: null,
    bankAccountName: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
}

/** Minimal ExecutionContext exposing a request with the given user. */
function makeContext(user: SafeUser | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows the route when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(makeContext(makeSafeUser('MEMBER')))).toBe(true);
  });

  it('allows the route when the required roles array is empty', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    expect(guard.canActivate(makeContext(makeSafeUser('MEMBER')))).toBe(true);
  });

  it('allows a user whose role is in the required set', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    expect(guard.canActivate(makeContext(makeSafeUser('ADMIN')))).toBe(true);
  });

  it('allows a user matching one of several required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN', 'COORDINATOR']);
    expect(guard.canActivate(makeContext(makeSafeUser('COORDINATOR')))).toBe(
      true,
    );
  });

  it('blocks a user whose role is not permitted', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    expect(() =>
      guard.canActivate(makeContext(makeSafeUser('MEMBER'))),
    ).toThrow(ForbiddenException);
  });

  it('blocks the route when there is no authenticated user', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
