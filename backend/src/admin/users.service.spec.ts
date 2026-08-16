import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Circle, CollectorApplication, Subscription, User } from '../entities';
import { UsersService } from './users.service';
import type { ListUsersDto } from './dto/query.dto';

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'ada@example.com',
    name: 'Ada',
    role: 'MEMBER',
    status: 'ACTIVE',
    passwordHash: 'secret',
    emailVerifiedAt: null,
    phone: null,
    phoneVerifiedAt: null,
    altPhone: null,
    bankName: null,
    bankAccountNumber: null,
    bankAccountName: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  } as unknown as User;
}

describe('UsersService', () => {
  let service: UsersService;
  let users: { findAndCount: jest.Mock; findOne: jest.Mock; save: jest.Mock };
  let circles: { count: jest.Mock };
  let subscriptions: { count: jest.Mock };
  let applications: { count: jest.Mock };

  beforeEach(() => {
    users = {
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((row) => Promise.resolve(row)),
    };
    circles = { count: jest.fn() };
    subscriptions = { count: jest.fn() };
    applications = { count: jest.fn() };
    service = new UsersService(
      users as unknown as Repository<User>,
      circles as unknown as Repository<Circle>,
      subscriptions as unknown as Repository<Subscription>,
      applications as unknown as Repository<CollectorApplication>,
    );
  });

  describe('list', () => {
    it('applies status, role and an OR search across name/phone', async () => {
      users.findAndCount.mockResolvedValue([[], 0]);
      const query = {
        page: 1,
        pageSize: 20,
        status: 'ACTIVE',
        role: 'COORDINATOR',
        search: '0803',
      } as ListUsersDto;

      await service.list(query);

      const where = users.findAndCount.mock.calls[0][0].where;
      expect(Array.isArray(where)).toBe(true);
      expect(where[0].status).toBe('ACTIVE');
      expect(where[0].role).toBe('COORDINATOR');
      expect(where[0]).toHaveProperty('name');
      expect(where[1]).toHaveProperty('phone');
    });

    it('strips users down to SafeUser (no passwordHash)', async () => {
      users.findAndCount.mockResolvedValue([[makeUser()], 1]);
      const result = await service.list({
        page: 1,
        pageSize: 20,
      });
      expect(result.items[0]).not.toHaveProperty('passwordHash');
    });
  });

  describe('get', () => {
    it('adds the relation counts', async () => {
      users.findOne.mockResolvedValue(makeUser());
      circles.count.mockResolvedValue(3);
      subscriptions.count.mockResolvedValue(1);
      applications.count.mockResolvedValue(2);

      const result = await service.get('user-1');

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.counts).toEqual({
        coordinatedCircles: 3,
        subscriptions: 1,
        applications: 2,
      });
    });

    it('throws NotFound for a missing user', async () => {
      users.findOne.mockResolvedValue(null);
      await expect(service.get('ghost')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('suspend', () => {
    it('suspends a normal member', async () => {
      users.findOne.mockResolvedValue(makeUser());

      const result = await service.suspend('user-1', 'admin-1');

      expect(users.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1', status: 'SUSPENDED' }),
      );
      expect(result.status).toBe('SUSPENDED');
    });

    it('refuses to let an admin suspend their own account', async () => {
      await expect(
        service.suspend('admin-1', 'admin-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(users.findOne).not.toHaveBeenCalled();
    });

    it('throws NotFound when the target does not exist', async () => {
      users.findOne.mockResolvedValue(null);
      await expect(service.suspend('ghost', 'admin-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('refuses to suspend another admin', async () => {
      users.findOne.mockResolvedValue(makeUser({ role: 'ADMIN' }));
      await expect(service.suspend('user-2', 'admin-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(users.save).not.toHaveBeenCalled();
    });
  });

  describe('reactivate', () => {
    it('sets a user back to ACTIVE', async () => {
      users.findOne.mockResolvedValue(makeUser({ status: 'SUSPENDED' }));

      const result = await service.reactivate('user-1');

      expect(users.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACTIVE' }),
      );
      expect(result.status).toBe('ACTIVE');
    });

    it('throws NotFound for a missing user', async () => {
      users.findOne.mockResolvedValue(null);
      await expect(service.reactivate('ghost')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
