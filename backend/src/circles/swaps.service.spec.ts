import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Membership, SwapRequest } from '../entities';
import { CirclesService } from './circles.service';
import { SwapsService } from './swaps.service';

function makeMembership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: 'm-a',
    circleId: 'circle-1',
    userId: 'u-a',
    name: 'Ada',
    phone: null,
    invitedEmail: null,
    position: 1,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as Membership;
}

describe('SwapsService', () => {
  let service: SwapsService;
  let swaps: {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let memberships: { findOne: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let circles: {
    collectedMembershipIds: jest.Mock;
    assertOwned: jest.Mock;
    openCycleState: jest.Mock;
  };

  const requester = makeMembership({ id: 'm-a', position: 1 });
  const target = makeMembership({ id: 'm-b', name: 'Bola', position: 4 });

  /** A fully-loaded swap row for toInfo() to map. */
  function swapRow(overrides: Partial<SwapRequest> = {}) {
    return {
      id: 'swap-1',
      circleId: 'circle-1',
      requesterId: 'm-a',
      targetId: 'm-b',
      status: 'PENDING',
      note: null,
      targetRespondedAt: null,
      coordinatorId: null,
      decidedAt: null,
      createdAt: new Date(),
      requester,
      target,
      coordinator: null,
      ...overrides,
    } as unknown as SwapRequest;
  }

  beforeEach(() => {
    swaps = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      save: jest.fn().mockImplementation((row) => Promise.resolve(row)),
      create: jest.fn().mockImplementation((row) => row),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    memberships = { findOne: jest.fn() };
    dataSource = {
      transaction: jest.fn().mockImplementation(async (cb) =>
        cb({ update: jest.fn() }),
      ),
    };
    circles = {
      collectedMembershipIds: jest.fn().mockResolvedValue(new Set<string>()),
      assertOwned: jest.fn().mockResolvedValue({ id: 'circle-1' }),
      openCycleState: jest.fn().mockResolvedValue(null),
    };
    service = new SwapsService(
      swaps as unknown as Repository<SwapRequest>,
      memberships as unknown as Repository<Membership>,
      dataSource as unknown as DataSource,
      circles as unknown as CirclesService,
    );
  });

  describe('create', () => {
    it('creates a PENDING swap between two eligible members', async () => {
      memberships.findOne.mockResolvedValue(target);
      swaps.findOne.mockResolvedValue(null); // no existing active request
      swaps.findOneOrFail.mockResolvedValue(swapRow());

      const info = await service.create('circle-1', requester, 'm-b', 'pls');

      expect(swaps.create).toHaveBeenCalledWith(
        expect.objectContaining({
          circleId: 'circle-1',
          requesterId: 'm-a',
          targetId: 'm-b',
          note: 'pls',
        }),
      );
      expect(info.status).toBe('PENDING');
      expect(info.isMine).toBe(true);
    });

    it('refuses swapping with yourself', async () => {
      await expect(
        service.create('circle-1', requester, 'm-a'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a target who has already collected', async () => {
      memberships.findOne.mockResolvedValue(target);
      circles.collectedMembershipIds.mockResolvedValue(new Set(['m-b']));
      await expect(
        service.create('circle-1', requester, 'm-b'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a second active request from the same member', async () => {
      memberships.findOne.mockResolvedValue(target);
      swaps.findOne.mockResolvedValue(swapRow()); // one already in progress
      await expect(
        service.create('circle-1', requester, 'm-b'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('404s when the target is not in the circle', async () => {
      memberships.findOne.mockResolvedValue(null);
      await expect(
        service.create('circle-1', requester, 'ghost'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('respond', () => {
    it('lets the target accept a pending request', async () => {
      swaps.findOne.mockResolvedValue(swapRow());
      swaps.findOneOrFail.mockResolvedValue(swapRow({ status: 'ACCEPTED' }));

      const info = await service.respond('swap-1', target, true);

      expect(swaps.update).toHaveBeenCalledWith(
        'swap-1',
        expect.objectContaining({ status: 'ACCEPTED' }),
      );
      expect(info.status).toBe('ACCEPTED');
    });

    it('rejects a response from someone who is not the target', async () => {
      swaps.findOne.mockResolvedValue(swapRow());
      await expect(
        service.respond('swap-1', makeMembership({ id: 'someone' }), true),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('decide (coordinator)', () => {
    it('confirms an accepted swap and swaps the two positions', async () => {
      swaps.findOne.mockResolvedValue(swapRow({ status: 'ACCEPTED' }));
      memberships.findOne
        .mockResolvedValueOnce(makeMembership({ id: 'm-a', position: 1 }))
        .mockResolvedValueOnce(
          makeMembership({ id: 'm-b', name: 'Bola', position: 4 }),
        );
      swaps.findOneOrFail.mockResolvedValue(swapRow({ status: 'CONFIRMED' }));

      const updates: Array<[unknown, string, unknown]> = [];
      dataSource.transaction.mockImplementation(async (cb) =>
        cb({
          update: (entity: unknown, id: string, data: unknown) => {
            updates.push([entity, id, data]);
            return Promise.resolve();
          },
        }),
      );

      const info = await service.decide('circle-1', 'coord-1', 'swap-1', true);

      // m-a takes m-b's position (4) and vice-versa.
      const posUpdates = updates.filter(([, , d]) =>
        Object.prototype.hasOwnProperty.call(d, 'position'),
      );
      expect(posUpdates).toContainEqual([Membership, 'm-a', { position: 4 }]);
      expect(posUpdates).toContainEqual([Membership, 'm-b', { position: 1 }]);
      expect(circles.openCycleState).toHaveBeenCalled();
      expect(info.status).toBe('CONFIRMED');
    });

    it('refuses to confirm a swap that has not been accepted yet', async () => {
      swaps.findOne.mockResolvedValue(swapRow({ status: 'PENDING' }));
      await expect(
        service.decide('circle-1', 'coord-1', 'swap-1', true),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('re-checks eligibility at confirm time (target has since collected)', async () => {
      swaps.findOne.mockResolvedValue(swapRow({ status: 'ACCEPTED' }));
      memberships.findOne
        .mockResolvedValueOnce(makeMembership({ id: 'm-a' }))
        .mockResolvedValueOnce(makeMembership({ id: 'm-b' }));
      circles.collectedMembershipIds.mockResolvedValue(new Set(['m-b']));

      await expect(
        service.decide('circle-1', 'coord-1', 'swap-1', true),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects an accepted swap without touching positions', async () => {
      swaps.findOne.mockResolvedValue(swapRow({ status: 'ACCEPTED' }));
      swaps.findOneOrFail.mockResolvedValue(swapRow({ status: 'REJECTED' }));

      const info = await service.decide(
        'circle-1',
        'coord-1',
        'swap-1',
        false,
      );

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(swaps.update).toHaveBeenCalledWith(
        'swap-1',
        expect.objectContaining({ status: 'REJECTED' }),
      );
      expect(info.status).toBe('REJECTED');
    });
  });
});
