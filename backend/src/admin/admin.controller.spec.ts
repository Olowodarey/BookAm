import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ROLES_KEY, RolesGuard } from '../auth/roles';
import type { SafeUser } from '../auth/auth.types';
import { AdminController } from './admin.controller';
import { OverviewService } from './overview.service';
import { ApplicationsService } from './applications.service';
import { PlansService } from './plans.service';
import { SubscriptionsService } from './subscriptions.service';
import { UsersService } from './users.service';
import type { ListUsersDto } from './dto/query.dto';

const admin: SafeUser = {
  id: 'admin-1',
  email: 'admin@bookam.test',
  name: 'Admin',
  role: 'ADMIN',
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

describe('AdminController', () => {
  let controller: AdminController;
  let overview: { metrics: jest.Mock };
  let applications: { list: jest.Mock; approve: jest.Mock; reject: jest.Mock };
  let plans: { create: jest.Mock; remove: jest.Mock };
  let subscriptions: { updateStatus: jest.Mock };
  let users: { list: jest.Mock; suspend: jest.Mock };

  beforeEach(() => {
    overview = { metrics: jest.fn().mockResolvedValue({ totalUsers: 1 }) };
    applications = {
      list: jest.fn(),
      approve: jest.fn().mockResolvedValue({ status: 'APPROVED' }),
      reject: jest.fn().mockResolvedValue({ status: 'REJECTED' }),
    };
    plans = { create: jest.fn(), remove: jest.fn() };
    subscriptions = { updateStatus: jest.fn() };
    users = { list: jest.fn(), suspend: jest.fn() };

    controller = new AdminController(
      overview as unknown as OverviewService,
      applications as unknown as ApplicationsService,
      plans as unknown as PlansService,
      subscriptions as unknown as SubscriptionsService,
      users as unknown as UsersService,
    );
  });

  describe('route protection', () => {
    it('guards every admin route with JWT auth and the roles guard', () => {
      const guards = Reflect.getMetadata('__guards__', AdminController) as
        unknown[] | undefined;
      expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    });

    it('restricts the controller to the ADMIN role', () => {
      const roles = new Reflector().get(ROLES_KEY, AdminController);
      expect(roles).toEqual(['ADMIN']);
    });
  });

  describe('delegation', () => {
    it('getOverview delegates to the overview service', async () => {
      await controller.getOverview();
      expect(overview.metrics).toHaveBeenCalledTimes(1);
    });

    it('listUsers passes the query through', () => {
      const query = { page: 1, pageSize: 20 } as ListUsersDto;
      void controller.listUsers(query);
      expect(users.list).toHaveBeenCalledWith(query);
    });

    it('approveApplication forwards the acting admin id and note', () => {
      void controller.approveApplication('app-1', { reviewNote: 'ok' }, admin);
      expect(applications.approve).toHaveBeenCalledWith(
        'app-1',
        'admin-1',
        'ok',
      );
    });

    it('rejectApplication forwards the acting admin id and note', () => {
      void controller.rejectApplication('app-1', { reviewNote: 'no' }, admin);
      expect(applications.reject).toHaveBeenCalledWith(
        'app-1',
        'admin-1',
        'no',
      );
    });

    it('suspendUser forwards the acting admin id (for the self-suspend guard)', () => {
      void controller.suspendUser('user-2', admin);
      expect(users.suspend).toHaveBeenCalledWith('user-2', 'admin-1');
    });

    it('updateSubscriptionStatus passes id and new status', () => {
      void controller.updateSubscriptionStatus('sub-1', {
        status: 'CANCELLED',
      });
      expect(subscriptions.updateStatus).toHaveBeenCalledWith(
        'sub-1',
        'CANCELLED',
      );
    });
  });
});
