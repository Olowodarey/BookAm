import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Subscription } from '../entities';
import { SubscriptionsService } from './subscriptions.service';
import type { ListSubscriptionsDto } from './dto/query.dto';

/** A minimal loaded subscription (user + plan) for the mapper to consume. */
function makeSub(overrides: Partial<Subscription> = {}) {
  return {
    id: 'sub-1',
    status: 'ACTIVE',
    userId: 'user-1',
    planId: 'plan-1',
    user: {
      id: 'user-1',
      email: 'ada@example.com',
      name: 'Ada',
      role: 'MEMBER',
      status: 'ACTIVE',
      emailVerifiedAt: null,
      phone: null,
      phoneVerifiedAt: null,
      altPhone: null,
      bankName: null,
      bankAccountNumber: null,
      bankAccountName: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      passwordHash: 'secret-hash',
    },
    plan: { id: 'plan-1', name: 'Starter', priceNaira: 0 },
    ...overrides,
  } as unknown as Subscription;
}

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let subscriptions: {
    findAndCount: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(() => {
    subscriptions = {
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    service = new SubscriptionsService(
      subscriptions as unknown as Repository<Subscription>,
    );
  });

  describe('list', () => {
    it('returns a paginated envelope and strips the user to a SafeUser', async () => {
      subscriptions.findAndCount.mockResolvedValue([[makeSub()], 1]);
      const query = { page: 1, pageSize: 20 } as ListSubscriptionsDto;

      const result = await service.list(query);

      expect(result.total).toBe(1);
      expect(result.items[0].id).toBe('sub-1');
      expect(result.items[0].user).not.toHaveProperty('passwordHash');
      expect(result.items[0].plan.name).toBe('Starter');
      expect(subscriptions.findAndCount.mock.calls[0][0].where).toEqual({});
    });

    it('filters by status when supplied', async () => {
      subscriptions.findAndCount.mockResolvedValue([[], 0]);
      const query = {
        page: 1,
        pageSize: 20,
        status: 'ACTIVE',
      } as ListSubscriptionsDto;

      await service.list(query);

      expect(subscriptions.findAndCount.mock.calls[0][0].where).toEqual({
        status: 'ACTIVE',
      });
    });
  });

  describe('updateStatus', () => {
    it('updates the status of an existing subscription', async () => {
      subscriptions.findOne.mockResolvedValue(makeSub());
      subscriptions.save.mockImplementation((s) => Promise.resolve(s));

      const result = await service.updateStatus('sub-1', 'CANCELLED');

      expect(subscriptions.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'sub-1', status: 'CANCELLED' }),
      );
      expect(result.status).toBe('CANCELLED');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('throws NotFound for a missing subscription', async () => {
      subscriptions.findOne.mockResolvedValue(null);
      await expect(
        service.updateStatus('ghost', 'EXPIRED'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(subscriptions.save).not.toHaveBeenCalled();
    });
  });
});
