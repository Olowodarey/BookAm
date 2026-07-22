import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationsService } from './applications.service';
import type { ListApplicationsDto } from './dto/query.dto';

/** Just the fields the service reads; the rest is opaque prisma output. */
function makeApplication(overrides: Record<string, unknown> = {}) {
  return {
    id: 'app-1',
    status: 'PENDING',
    applicantId: 'user-1',
    ...overrides,
  };
}

describe('ApplicationsService', () => {
  let service: ApplicationsService;
  let prisma: {
    collectorApplication: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    user: { updateMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      collectorApplication: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      user: { updateMany: jest.fn() },
      $transaction: jest.fn(),
    };
    service = new ApplicationsService(prisma as unknown as PrismaService);
  });

  describe('list', () => {
    it('returns a paginated envelope and applies paging', async () => {
      const items = [makeApplication()];
      prisma.$transaction.mockResolvedValue([items, 1]);

      const query = { page: 2, pageSize: 20 } as ListApplicationsDto;
      const result = await service.list(query);

      expect(result).toEqual({ items, total: 1, page: 2, pageSize: 20 });
      expect(prisma.collectorApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
    });

    it('filters by status and search when supplied', async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);
      const query = {
        page: 1,
        pageSize: 20,
        status: 'PENDING',
        search: 'Ada',
      } as ListApplicationsDto;

      await service.list(query);

      const where = prisma.collectorApplication.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('PENDING');
      expect(where.applicant.OR).toEqual([
        { name: { contains: 'Ada', mode: 'insensitive' } },
        { phone: { contains: 'Ada' } },
      ]);
    });
  });

  describe('get', () => {
    it('throws NotFound for a missing application', async () => {
      prisma.collectorApplication.findUnique.mockResolvedValue(null);
      await expect(service.get('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('approve', () => {
    it('approves a pending application and promotes the applicant', async () => {
      prisma.collectorApplication.findUnique
        .mockResolvedValueOnce(makeApplication()) // get() precheck
        .mockResolvedValueOnce(makeApplication({ status: 'APPROVED' })); // final get()
      prisma.$transaction.mockResolvedValue([
        makeApplication({ status: 'APPROVED' }),
        { count: 1 },
      ]);

      const result = await service.approve('app-1', 'admin-1', 'looks good');

      expect(result.status).toBe('APPROVED');
      // Only MEMBER applicants get promoted — never an admin.
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1', role: 'MEMBER' },
        data: { role: 'COORDINATOR' },
      });
    });

    it('rejects re-approving an already-reviewed application', async () => {
      prisma.collectorApplication.findUnique.mockResolvedValue(
        makeApplication({ status: 'APPROVED' }),
      );
      await expect(service.approve('app-1', 'admin-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('rejects a pending application with a note', async () => {
      prisma.collectorApplication.findUnique.mockResolvedValue(
        makeApplication(),
      );
      prisma.collectorApplication.update.mockResolvedValue(
        makeApplication({ status: 'REJECTED' }),
      );

      const result = await service.reject('app-1', 'admin-1', 'incomplete');

      expect(prisma.collectorApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'app-1' },
          data: expect.objectContaining({
            status: 'REJECTED',
            reviewNote: 'incomplete',
            reviewedById: 'admin-1',
          }),
        }),
      );
      expect(result.status).toBe('REJECTED');
      // A rejected application must not promote anyone.
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('refuses to reject an application that is not pending', async () => {
      prisma.collectorApplication.findUnique.mockResolvedValue(
        makeApplication({ status: 'REJECTED' }),
      );
      await expect(service.reject('app-1', 'admin-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.collectorApplication.update).not.toHaveBeenCalled();
    });
  });
});
