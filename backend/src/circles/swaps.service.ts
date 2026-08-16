import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsRelations, In, Repository } from 'typeorm';
import { Membership, SwapRequest } from '../entities';
import { CirclesService } from './circles.service';
import type { SwapRequestInfo } from './circles.types';

const swapRelations: FindOptionsRelations<SwapRequest> = {
  requester: true,
  target: true,
  coordinator: true,
};

/** PENDING or ACCEPTED — a request that hasn't reached a terminal state. */
const ACTIVE_SWAP = In(['PENDING', 'ACCEPTED']);

/**
 * Peer-to-peer position swaps. A member asks to swap rotation positions with
 * another member; the target accepts; the coordinator confirms, which swaps the
 * two memberships' `position` values. Eligibility (both ACTIVE, neither has
 * collected) is checked at request time and re-checked at confirmation, since
 * the circle can change in between. Everything stays a visible record.
 */
@Injectable()
export class SwapsService {
  constructor(
    @InjectRepository(SwapRequest)
    private readonly swaps: Repository<SwapRequest>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly circles: CirclesService,
  ) {}

  /**
   * All swap requests for a circle, newest first, rendered for a viewer.
   * `viewerMembershipId` is null when the coordinator is looking (they get the
   * confirm/reject affordance instead of respond/cancel).
   */
  async list(
    circleId: string,
    viewerMembershipId: string | null,
  ): Promise<SwapRequestInfo[]> {
    const rows = await this.swaps.find({
      where: { circleId },
      relations: swapRelations,
      order: { createdAt: 'DESC' },
    });
    return rows.map((s) => this.toInfo(s, viewerMembershipId));
  }

  /** Member action: request a swap with a specific member. */
  async create(
    circleId: string,
    requester: Membership,
    targetMembershipId: string,
    note?: string,
  ): Promise<SwapRequestInfo> {
    if (targetMembershipId === requester.id) {
      throw new BadRequestException('You cannot swap with yourself');
    }
    const target = await this.memberships.findOne({
      where: { id: targetMembershipId },
    });
    if (!target || target.circleId !== circleId) {
      throw new NotFoundException('That member is not in this circle');
    }

    const collected = await this.circles.collectedMembershipIds(circleId);
    this.assertSwappable(requester, target, collected);

    // One active request per requester per circle.
    const existing = await this.swaps.findOne({
      where: { circleId, requesterId: requester.id, status: ACTIVE_SWAP },
    });
    if (existing) {
      throw new ConflictException(
        'You already have a swap request in progress for this circle',
      );
    }

    const created = await this.swaps.save(
      this.swaps.create({
        circleId,
        requesterId: requester.id,
        targetId: target.id,
        note: note ?? null,
      }),
    );
    return this.toInfo(await this.reload(created.id), requester.id);
  }

  /** Requester action: withdraw an unresolved request. */
  async cancel(swapId: string, requester: Membership): Promise<SwapRequestInfo> {
    const swap = await this.activeSwapInCircle(swapId, requester.circleId);
    if (swap.requesterId !== requester.id) {
      throw new NotFoundException('Swap request not found');
    }
    await this.swaps.update(swapId, { status: 'CANCELLED' });
    return this.toInfo(await this.reload(swapId), requester.id);
  }

  /** Target action: accept (→ awaits coordinator) or decline a pending request. */
  async respond(
    swapId: string,
    target: Membership,
    accept: boolean,
  ): Promise<SwapRequestInfo> {
    const swap = await this.activeSwapInCircle(swapId, target.circleId);
    if (swap.targetId !== target.id) {
      throw new NotFoundException('Swap request not found');
    }
    if (swap.status !== 'PENDING') {
      throw new BadRequestException(
        'This swap request has already been responded to',
      );
    }
    await this.swaps.update(swapId, {
      status: accept ? 'ACCEPTED' : 'DECLINED',
      targetRespondedAt: new Date(),
    });
    return this.toInfo(await this.reload(swapId), target.id);
  }

  /**
   * Coordinator action: confirm or reject a target-accepted swap. Confirming
   * swaps the two memberships' positions (in a transaction) and re-resolves the
   * open cycle's collector; eligibility is re-checked first.
   */
  async decide(
    circleId: string,
    coordinatorId: string,
    swapId: string,
    confirm: boolean,
    note?: string,
  ): Promise<SwapRequestInfo> {
    const circle = await this.circles.assertOwned(circleId, coordinatorId);
    const swap = await this.swaps.findOne({ where: { id: swapId } });
    if (!swap || swap.circleId !== circleId) {
      throw new NotFoundException('Swap request not found');
    }
    if (swap.status !== 'ACCEPTED') {
      throw new BadRequestException(
        'Only a swap the other member has accepted can be confirmed',
      );
    }

    if (confirm) {
      const [requester, target] = await Promise.all([
        this.memberships.findOne({ where: { id: swap.requesterId } }),
        this.memberships.findOne({ where: { id: swap.targetId } }),
      ]);
      const collected = await this.circles.collectedMembershipIds(circleId);
      if (!requester || !target) {
        throw new BadRequestException('A member in this swap no longer exists');
      }
      this.assertSwappable(requester, target, collected);

      await this.dataSource.transaction(async (manager) => {
        // Swap the two positions.
        await manager.update(Membership, requester.id, {
          position: target.position,
        });
        await manager.update(Membership, target.id, {
          position: requester.position,
        });
        await manager.update(SwapRequest, swapId, {
          status: 'CONFIRMED',
          coordinatorId,
          decidedAt: new Date(),
          ...(note !== undefined ? { note } : {}),
        });
      });
      // Rotation changed — re-resolve the open cycle's collector.
      await this.circles.openCycleState(circle);
    } else {
      await this.swaps.update(swapId, {
        status: 'REJECTED',
        coordinatorId,
        decidedAt: new Date(),
        ...(note !== undefined ? { note } : {}),
      });
    }

    return this.toInfo(await this.reload(swapId), null);
  }

  /** Both members must be ACTIVE and not yet have collected this rotation. */
  private assertSwappable(
    requester: Membership,
    target: Membership,
    collected: Set<string>,
  ): void {
    if (requester.status !== 'ACTIVE' || target.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Both members must be active in the circle to swap',
      );
    }
    if (collected.has(requester.id)) {
      throw new BadRequestException(
        'You have already collected this rotation — there is no turn to swap',
      );
    }
    if (collected.has(target.id)) {
      throw new BadRequestException(
        'That member has already collected this rotation',
      );
    }
  }

  private async activeSwapInCircle(
    swapId: string,
    circleId: string,
  ): Promise<SwapRequest> {
    const swap = await this.swaps.findOne({ where: { id: swapId } });
    if (!swap || swap.circleId !== circleId) {
      throw new NotFoundException('Swap request not found');
    }
    if (swap.status !== 'PENDING' && swap.status !== 'ACCEPTED') {
      throw new BadRequestException('This swap request is already resolved');
    }
    return swap;
  }

  private reload(swapId: string): Promise<SwapRequest> {
    return this.swaps.findOneOrFail({
      where: { id: swapId },
      relations: swapRelations,
    });
  }

  private toInfo(
    swap: SwapRequest,
    viewerMembershipId: string | null,
  ): SwapRequestInfo {
    const isMine = swap.requesterId === viewerMembershipId;
    const isForMe = swap.targetId === viewerMembershipId;
    return {
      id: swap.id,
      circleId: swap.circleId,
      requesterName: swap.requester.name,
      requesterPosition: swap.requester.position,
      targetName: swap.target.name,
      targetPosition: swap.target.position,
      status: swap.status,
      note: swap.note,
      isMine,
      isForMe,
      canRespond: swap.status === 'PENDING' && isForMe,
      canCancel:
        (swap.status === 'PENDING' || swap.status === 'ACCEPTED') && isMine,
      // Coordinator view (viewerMembershipId null) may act on accepted swaps.
      canDecide: swap.status === 'ACCEPTED' && viewerMembershipId === null,
      createdAt: swap.createdAt,
      targetRespondedAt: swap.targetRespondedAt,
      decidedByName: swap.coordinator?.name ?? null,
      decidedAt: swap.decidedAt,
    };
  }
}
