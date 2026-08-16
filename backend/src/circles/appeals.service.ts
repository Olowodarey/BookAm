import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, Repository } from 'typeorm';
import { Appeal, AppealVote, Circle, Membership, VoteValue } from '../entities';
import { CirclesService } from './circles.service';
import type { AppealInfo } from './circles.types';

const appealRelations: FindOptionsRelations<Appeal> = {
  appellant: true,
  decidedBy: true,
  votes: true,
};

/**
 * "Consider me to collect next" appeals. Members create, withdraw and vote
 * (advisory, one changeable vote each); the circle's coordinator decides.
 * Everything — reason, tally, outcome, who decided — stays visible to the
 * whole circle for trust.
 */
@Injectable()
export class AppealsService {
  constructor(
    @InjectRepository(Appeal) private readonly appeals: Repository<Appeal>,
    @InjectRepository(AppealVote)
    private readonly votes: Repository<AppealVote>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectRepository(Circle) private readonly circleRepo: Repository<Circle>,
    private readonly circles: CirclesService,
  ) {}

  /**
   * All appeals of a circle, newest first, rendered for a viewer.
   * `viewerMembershipId` is null when the coordinator is looking.
   */
  async list(
    circleId: string,
    viewerMembershipId: string | null,
  ): Promise<AppealInfo[]> {
    const appeals = await this.appeals.find({
      where: { circleId },
      relations: appealRelations,
      order: { createdAt: 'DESC' },
    });
    return appeals.map((a) => this.toInfo(a, viewerMembershipId));
  }

  /** Member action: open an appeal. One open appeal per member per circle. */
  async create(
    circleId: string,
    membership: Membership,
    reason: string,
  ): Promise<AppealInfo> {
    const collected = await this.circles.collectedMembershipIds(circleId);
    if (collected.has(membership.id)) {
      throw new BadRequestException(
        'You have already collected in this circle, so the queue moves on to others',
      );
    }
    const open = await this.appeals.findOne({
      where: { circleId, appellantId: membership.id, status: 'OPEN' },
    });
    if (open) {
      throw new ConflictException(
        'You already have an open appeal in this circle',
      );
    }
    const created = await this.appeals.save(
      this.appeals.create({ circleId, appellantId: membership.id, reason }),
    );
    return this.toInfo(await this.reload(created.id), membership.id);
  }

  /** Member action: withdraw my own appeal while it is still open. */
  async withdraw(
    appealId: string,
    membership: Membership,
  ): Promise<AppealInfo> {
    const appeal = await this.openAppealInCircle(appealId, membership.circleId);
    if (appeal.appellantId !== membership.id) {
      throw new NotFoundException('Appeal not found');
    }
    await this.appeals.update(appealId, {
      status: 'WITHDRAWN',
      decidedAt: new Date(),
    });
    return this.toInfo(await this.reload(appealId), membership.id);
  }

  /**
   * Member action: cast or change my vote on an open appeal. The appellant
   * cannot vote on their own appeal; the DB's (appeal, voter) unique key
   * backs the one-vote-per-member rule.
   */
  async vote(
    appealId: string,
    membership: Membership,
    value: VoteValue,
  ): Promise<AppealInfo> {
    const appeal = await this.openAppealInCircle(appealId, membership.circleId);
    if (appeal.appellantId === membership.id) {
      throw new BadRequestException('You cannot vote on your own appeal');
    }
    const existing = await this.votes.findOne({
      where: { appealId, voterId: membership.id },
    });
    if (existing) {
      existing.value = value;
      await this.votes.save(existing);
    } else {
      await this.votes.save(
        this.votes.create({ appealId, voterId: membership.id, value }),
      );
    }
    return this.toInfo(await this.reload(appealId), membership.id);
  }

  /**
   * Coordinator action: approve or reject an open appeal. Approving moves
   * the appellant to the front of the not-yet-collected queue, right after
   * the member currently collecting — they collect next.
   */
  async decide(
    circleId: string,
    coordinatorId: string,
    appealId: string,
    approve: boolean,
    outcomeNote?: string,
  ): Promise<AppealInfo> {
    const circle = await this.circles.assertOwned(circleId, coordinatorId);
    const appeal = await this.openAppealInCircle(appealId, circleId);

    if (approve) {
      const appellant = await this.memberships.findOne({
        where: { id: appeal.appellantId },
      });
      if (!appellant || appellant.status !== 'ACTIVE') {
        throw new BadRequestException(
          'The appellant is no longer an active member of this circle',
        );
      }
      const collected = await this.circles.collectedMembershipIds(circleId);
      if (collected.has(appellant.id)) {
        throw new BadRequestException(
          'This member has already collected in this circle',
        );
      }
      await this.moveNextInRotation(circle.id, appellant.id);
    }

    await this.appeals.update(appealId, {
      status: approve ? 'APPROVED' : 'REJECTED',
      decidedById: coordinatorId,
      decidedAt: new Date(),
      outcomeNote: outcomeNote ?? null,
    });
    return this.toInfo(await this.reload(appealId), null);
  }

  /**
   * Reorders active members so `membershipId` is the next collector after
   * the current one (the running turn is never interrupted). Positions are
   * reassigned 1..n in the new order.
   */
  private async moveNextInRotation(
    circleId: string,
    membershipId: string,
  ): Promise<void> {
    const circle = await this.circleRepo.findOneByOrFail({ id: circleId });
    const state = await this.circles.openCycleState(circle);
    const members =
      state?.members ?? (await this.circles.activeMembers(circleId));
    const collected =
      state?.collectedIds ??
      (await this.circles.collectedMembershipIds(circleId));

    const appellant = members.find((m) => m.id === membershipId);
    if (!appellant) return;
    const currentCollectorId = state?.collector?.id ?? null;
    if (currentCollectorId === membershipId) return; // already collecting now

    const rest = members.filter((m) => m.id !== membershipId);
    // Insert right after the current collector; with no open turn, insert
    // before the first member who hasn't collected yet.
    let insertAt: number;
    if (currentCollectorId) {
      insertAt = rest.findIndex((m) => m.id === currentCollectorId) + 1;
    } else {
      const firstPending = rest.findIndex((m) => !collected.has(m.id));
      insertAt = firstPending === -1 ? rest.length : firstPending;
    }
    rest.splice(insertAt, 0, appellant);

    await Promise.all(
      rest.map((m, index) =>
        this.memberships.update(m.id, { position: index + 1 }),
      ),
    );
  }

  private async openAppealInCircle(
    appealId: string,
    circleId: string,
  ): Promise<Appeal> {
    const appeal = await this.appeals.findOne({ where: { id: appealId } });
    if (!appeal || appeal.circleId !== circleId) {
      throw new NotFoundException('Appeal not found');
    }
    if (appeal.status !== 'OPEN') {
      throw new BadRequestException('This appeal has already been decided');
    }
    return appeal;
  }

  private reload(appealId: string): Promise<Appeal> {
    return this.appeals.findOneOrFail({
      where: { id: appealId },
      relations: appealRelations,
    });
  }

  private toInfo(
    appeal: Appeal,
    viewerMembershipId: string | null,
  ): AppealInfo {
    const myVote =
      appeal.votes.find((v) => v.voterId === viewerMembershipId)?.value ?? null;
    const isMine = appeal.appellantId === viewerMembershipId;
    return {
      id: appeal.id,
      circleId: appeal.circleId,
      appellantName: appeal.appellant.name,
      appellantPosition: appeal.appellant.position,
      isMine,
      reason: appeal.reason,
      status: appeal.status,
      supportCount: appeal.votes.filter((v) => v.value === 'SUPPORT').length,
      opposeCount: appeal.votes.filter((v) => v.value === 'OPPOSE').length,
      myVote,
      canVote:
        appeal.status === 'OPEN' && viewerMembershipId !== null && !isMine,
      createdAt: appeal.createdAt,
      decidedByName: appeal.decidedBy?.name ?? null,
      decidedAt: appeal.decidedAt,
      outcomeNote: appeal.outcomeNote,
    };
  }
}
