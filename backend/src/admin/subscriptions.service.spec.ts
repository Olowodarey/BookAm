import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from './subscriptions.service';
import type { ListSubscriptionsDto } from './dto/query.dto';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: {
    subscription: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      subscription: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    service = new SubscriptionsService(prisma as unknown as PrismaService);
  });

  describe('list', () => {
    it('returns a paginated envelope with no filter by default', async () => {
      prisma.$transaction.mockResolvedValue([[{ id: 'sub-1' }], 1]);
      const query = { page: 1, pageSize: 20 } as ListSubscriptionsDto;

      const result = await service.list(query);

      expect(result).toEqual({
        items: [{ id: 'sub-1' }],
        total: 1,
        page: 1,
        pageSize: 20,
      });
      expect(prisma.subscription.findMany.mock.calls[0][0].where).toEqual({});
    });

    it('filters by status when supplied', async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);
      const query = {
        page: 1,
        pageSize: 20,
        status: 'ACTIVE',
      } as ListSubscriptionsDto;

      await service.list(query);

      expect(prisma.subscription.findMany.mock.calls[0][0].where).toEqual({
        status: 'ACTIVE',
      });
    });
  });

  describe('updateStatus', () => {
    it('updates the status of an existing subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-1' });
      prisma.subscription.update.mockResolvedValue({
        id: 'sub-1',
        status: 'CANCELLED',
      });

      const result = await service.updateStatus('sub-1', 'CANCELLED');

      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1' },
          data: { status: 'CANCELLED' },
        }),
      );
      expect(result.status).toBe('CANCELLED');
    });

    it('throws NotFound for a missing subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      await expect(
        service.updateStatus('ghost', 'EXPIRED'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });
  });
});
