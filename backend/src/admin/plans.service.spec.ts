import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { Subscription, SubscriptionPlan } from '../entities';
import { PlansService } from './plans.service';
import type { CreatePlanDto } from './dto/plan.dto';

/** A Postgres unique-violation, as TypeORM surfaces it (was Prisma P2002). */
function duplicateNameError() {
  return new QueryFailedError('insert', undefined, {
    code: '23505',
  } as unknown as Error);
}

describe('PlansService', () => {
  let service: PlansService;
  let plans: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    create: jest.Mock;
  };
  let subscriptions: { count: jest.Mock };

  beforeEach(() => {
    plans = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      create: jest.fn().mockImplementation((row) => row),
    };
    subscriptions = { count: jest.fn() };
    service = new PlansService(
      plans as unknown as Repository<SubscriptionPlan>,
      subscriptions as unknown as Repository<Subscription>,
    );
  });

  describe('create', () => {
    it('applies defaults for optional fields', async () => {
      plans.save.mockResolvedValue({ id: 'plan-1' });
      const dto = {
        name: 'Basic',
        priceNaira: 1000,
        interval: 'MONTHLY',
      } as CreatePlanDto;

      await service.create(dto);

      expect(plans.create).toHaveBeenCalledWith({
        name: 'Basic',
        priceNaira: 1000,
        interval: 'MONTHLY',
        maxCircles: null,
        features: [],
        active: true,
      });
      expect(plans.save).toHaveBeenCalled();
    });

    it('translates a duplicate-name constraint into a Conflict', async () => {
      plans.save.mockRejectedValue(duplicateNameError());
      await expect(
        service.create({
          name: 'Basic',
          priceNaira: 1000,
          interval: 'MONTHLY',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('re-throws unexpected errors untouched', async () => {
      plans.save.mockRejectedValue(new Error('db down'));
      await expect(
        service.create({
          name: 'Basic',
          priceNaira: 1000,
          interval: 'MONTHLY',
        }),
      ).rejects.toThrow('db down');
    });
  });

  describe('update', () => {
    it('throws NotFound when the plan does not exist', async () => {
      plans.findOne.mockResolvedValue(null);
      await expect(
        service.update('nope', { name: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(plans.save).not.toHaveBeenCalled();
    });

    it('only changes fields that were provided', async () => {
      plans.findOne.mockResolvedValue({ id: 'plan-1', priceNaira: 1000 });
      plans.save.mockImplementation((row) => Promise.resolve(row));

      await service.update('plan-1', { priceNaira: 2500 });

      expect(plans.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'plan-1', priceNaira: 2500 }),
      );
    });

    it('maps a duplicate name to a Conflict', async () => {
      plans.findOne.mockResolvedValue({ id: 'plan-1' });
      plans.save.mockRejectedValue(duplicateNameError());
      await expect(
        service.update('plan-1', { name: 'Taken' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('remove', () => {
    it('hard-deletes a plan that has no subscribers', async () => {
      plans.findOne.mockResolvedValue({ id: 'plan-1' });
      subscriptions.count.mockResolvedValue(0);
      plans.delete.mockResolvedValue({ affected: 1 });

      const result = await service.remove('plan-1');

      expect(result.deleted).toBe(true);
      expect(plans.delete).toHaveBeenCalledWith({ id: 'plan-1' });
    });

    it('deactivates instead of deleting when subscribers exist', async () => {
      plans.findOne.mockResolvedValue({ id: 'plan-1', active: true });
      subscriptions.count.mockResolvedValue(4);
      plans.save.mockImplementation((row) => Promise.resolve(row));

      const result = await service.remove('plan-1');

      expect(result.deleted).toBe(false);
      expect(result.plan.active).toBe(false);
      expect(plans.delete).not.toHaveBeenCalled();
    });

    it('throws NotFound for a missing plan', async () => {
      plans.findOne.mockResolvedValue(null);
      await expect(service.remove('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
