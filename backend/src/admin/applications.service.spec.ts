import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CollectorApplication, User } from '../entities';
import { ApplicationsService } from './applications.service';
import type { ListApplicationsDto } from './dto/query.dto';

const applicant = {
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
  passwordHash: 'secret',
};

/** Just the fields the service reads, with the applicant relation loaded. */
function makeApplication(overrides: Record<string, unknown> = {}) {
  return {
    id: 'app-1',
    status: 'PENDING',
    applicantId: 'user-1',
    reviewNote: null,
    reviewedById: null,
    reviewedAt: null,
    applicant,
    reviewedBy: null,
    ...overrides,
  };
}

describe('ApplicationsService', () => {
  let service: ApplicationsService;
  let applications: {
    findAndCount: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let users: { update: jest.Mock };

  beforeEach(() => {
    applications = {
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((row) => Promise.resolve(row)),
    };
    users = { update: jest.fn() };
    service = new ApplicationsService(
      applications as unknown as Repository<CollectorApplication>,
      users as unknown as Repository<User>,
    );
  });

  describe('list', () => {
    it('returns a paginated envelope and applies paging', async () => {
      applications.findAndCount.mockResolvedValue([[makeApplication()], 1]);

      const query = { page: 2, pageSize: 20 } as ListApplicationsDto;
      const result = await service.list(query);

      expect(result.total).toBe(1);
      expect(result.page).toBe(2);
      expect(result.items[0].id).toBe('app-1');
      expect(result.items[0].applicant).not.toHaveProperty('passwordHash');
      expect(applications.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
    });

    it('builds an OR search across the applicant when supplied', async () => {
      applications.findAndCount.mockResolvedValue([[], 0]);
      const query = {
        page: 1,
        pageSize: 20,
        status: 'PENDING',
        search: 'Ada',
      } as ListApplicationsDto;

      await service.list(query);

      const where = applications.findAndCount.mock.calls[0][0].where;
      expect(Array.isArray(where)).toBe(true);
      expect(where[0].status).toBe('PENDING');
      expect(where[0].applicant).toHaveProperty('name');
      expect(where[1].applicant).toHaveProperty('phone');
    });
  });

  describe('get', () => {
    it('throws NotFound for a missing application', async () => {
      applications.findOne.mockResolvedValue(null);
      await expect(service.get('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('approve', () => {
    it('approves a pending application and promotes the applicant', async () => {
      applications.findOne
        .mockResolvedValueOnce(makeApplication()) // precheck
        .mockResolvedValueOnce(makeApplication({ status: 'APPROVED' })); // get() reload

      const result = await service.approve('app-1', 'admin-1', 'looks good');

      expect(result.status).toBe('APPROVED');
      // Only MEMBER applicants get promoted — never an admin.
      expect(users.update).toHaveBeenCalledWith(
        { id: 'user-1', role: 'MEMBER' },
        { role: 'COORDINATOR' },
      );
    });

    it('rejects re-approving an already-reviewed application', async () => {
      applications.findOne.mockResolvedValue(
        makeApplication({ status: 'APPROVED' }),
      );
      await expect(service.approve('app-1', 'admin-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(users.update).not.toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('rejects a pending application with a note', async () => {
      applications.findOne
        .mockResolvedValueOnce(makeApplication()) // precheck
        .mockResolvedValueOnce(makeApplication({ status: 'REJECTED' })); // reload

      const result = await service.reject('app-1', 'admin-1', 'incomplete');

      expect(applications.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'REJECTED',
          reviewNote: 'incomplete',
          reviewedById: 'admin-1',
        }),
      );
      expect(result.status).toBe('REJECTED');
      // A rejected application must not promote anyone.
      expect(users.update).not.toHaveBeenCalled();
    });

    it('refuses to reject an application that is not pending', async () => {
      applications.findOne.mockResolvedValue(
        makeApplication({ status: 'REJECTED' }),
      );
      await expect(service.reject('app-1', 'admin-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(applications.save).not.toHaveBeenCalled();
    });
  });
});
