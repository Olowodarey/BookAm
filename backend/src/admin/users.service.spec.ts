import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';
import type { ListUsersDto } from './dto/query.dto';

function makeUser(overrides: Record<string, unknown> = {}) {
  return { id: 'user-1', role: 'MEMBER', status: 'ACTIVE', ...overrides };
}

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  describe('list', () => {
    it('applies status, role and search filters', async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);
      const query = {
        page: 1,
        pageSize: 20,
        status: 'ACTIVE',
        role: 'COORDINATOR',
        search: '0803',
      } as ListUsersDto;

      await service.list(query);

      const where = prisma.user.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('ACTIVE');
      expect(where.role).toBe('COORDINATOR');
      expect(where.OR).toEqual([
        { name: { contains: '0803', mode: 'insensitive' } },
        { phone: { contains: '0803' } },
      ]);
    });
  });

  describe('get', () => {
    it('flattens the _count relation into counts', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({
          _count: {
            coordinatedCircles: 3,
            subscriptions: 1,
            applications: 2,
          },
        }),
      );

      const result = await service.get('user-1');

      expect(result).not.toHaveProperty('_count');
      expect(result.counts).toEqual({
        coordinatedCircles: 3,
        subscriptions: 1,
        applications: 2,
      });
    });

    it('throws NotFound for a missing user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.get('ghost')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('suspend', () => {
    it('suspends a normal member', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      prisma.user.update.mockResolvedValue(makeUser({ status: 'SUSPENDED' }));

      const result = await service.suspend('user-1', 'admin-1');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { status: 'SUSPENDED' },
        }),
      );
      expect(result.status).toBe('SUSPENDED');
    });

    it('refuses to let an admin suspend their own account', async () => {
      await expect(
        service.suspend('admin-1', 'admin-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFound when the target does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.suspend('ghost', 'admin-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('refuses to suspend another admin', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser({ role: 'ADMIN' }));
      await expect(service.suspend('user-2', 'admin-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('reactivate', () => {
    it('sets a user back to ACTIVE', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ status: 'SUSPENDED' }),
      );
      prisma.user.update.mockResolvedValue(makeUser({ status: 'ACTIVE' }));

      const result = await service.reactivate('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'ACTIVE' } }),
      );
      expect(result.status).toBe('ACTIVE');
    });

    it('throws NotFound for a missing user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.reactivate('ghost')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
