import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from './plans.service';
import type { CreatePlanDto } from './dto/plan.dto';

function duplicateNameError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint', {
    code: 'P2002',
    clientVersion: '6.0.0',
  });
}

describe('PlansService', () => {
  let service: PlansService;
  let prisma: {
    subscriptionPlan: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    subscription: { count: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      subscriptionPlan: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      subscription: { count: jest.fn() },
    };
    service = new PlansService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('applies defaults for optional fields', async () => {
      prisma.subscriptionPlan.create.mockResolvedValue({ id: 'plan-1' });
      const dto = {
        name: 'Basic',
        priceNaira: 1000,
        interval: 'MONTHLY',
      } as CreatePlanDto;

      await service.create(dto);

      expect(prisma.subscriptionPlan.create).toHaveBeenCalledWith({
        data: {
          name: 'Basic',
          priceNaira: 1000,
          interval: 'MONTHLY',
          maxCircles: null,
          features: [],
          active: true,
        },
      });
    });

    it('translates a duplicate-name constraint into a Conflict', async () => {
      prisma.subscriptionPlan.create.mockRejectedValue(duplicateNameError());
      await expect(
        service.create({
          name: 'Basic',
          priceNaira: 1000,
          interval: 'MONTHLY',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('re-throws unexpected errors untouched', async () => {
      prisma.subscriptionPlan.create.mockRejectedValue(new Error('db down'));
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
      prisma.subscriptionPlan.findUnique.mockResolvedValue(null);
      await expect(
        service.update('nope', { name: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.subscriptionPlan.update).not.toHaveBeenCalled();
    });

    it('only sends fields that were provided', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-1' });
      prisma.subscriptionPlan.update.mockResolvedValue({ id: 'plan-1' });

      await service.update('plan-1', { priceNaira: 2500 });

      expect(prisma.subscriptionPlan.update).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
        data: { priceNaira: 2500 },
      });
    });

    it('maps a duplicate name to a Conflict', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-1' });
      prisma.subscriptionPlan.update.mockRejectedValue(duplicateNameError());
      await expect(
        service.update('plan-1', { name: 'Taken' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('remove', () => {
    it('hard-deletes a plan that has no subscribers', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-1' });
      prisma.subscription.count.mockResolvedValue(0);
      prisma.subscriptionPlan.delete.mockResolvedValue({ id: 'plan-1' });

      const result = await service.remove('plan-1');

      expect(result.deleted).toBe(true);
      expect(prisma.subscriptionPlan.delete).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
      });
    });

    it('deactivates instead of deleting when subscribers exist', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan-1' });
      prisma.subscription.count.mockResolvedValue(4);
      prisma.subscriptionPlan.update.mockResolvedValue({
        id: 'plan-1',
        active: false,
      });

      const result = await service.remove('plan-1');

      expect(result.deleted).toBe(false);
      expect(result.plan.active).toBe(false);
      expect(prisma.subscriptionPlan.delete).not.toHaveBeenCalled();
      expect(prisma.subscriptionPlan.update).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
        data: { active: false },
      });
    });

    it('throws NotFound for a missing plan', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue(null);
      await expect(service.remove('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
