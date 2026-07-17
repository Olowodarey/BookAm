import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  Circle,
  Contribution,
  Cycle,
  Membership,
  Payout,
  User,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCircleDto } from './dto/circle.dto';
import type {
  ActiveCycleInfo,
  CircleDetail,
  CircleSummary,
  ContributionInfo,
  MemberInfo,
  PayoutInfo,
} from './circles.types';

/**
 * The hydrated "what's happening right now" view of a circle's open cycle.
 * Shared by the list/detail endpoints and the contribution/payout services.
 */
export interface OpenCycleState {
  cycle: Cycle;
  /** ACTIVE memberships ordered by rotation position. */
  members: Membership[];
  /** Membership ids that already received a completed payout in this circle. */
  collectedIds: Set<string>;
  collector: Membership | null;
}

@Injectable()
export class CirclesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every coordinator endpoint goes through this: a circle that doesn't exist
   * and a circle owned by someone else both 404, so ids can't be probed.
   */
  async assertOwned(circleId: string, coordinatorId: string): Promise<Circle> {
    const circle = await this.prisma.circle.findUnique({
      where: { id: circleId },
    });
    if (!circle || circle.coordinatorId !== coordinatorId) {
      throw new NotFoundException('Circle not found');
    }
    return circle;
  }

  activeMembers(circleId: string): Promise<Membership[]> {
    return this.prisma.membership.findMany({
      where: { circleId, status: 'ACTIVE' },
      orderBy: { position: 'asc' },
    });
  }

  /**
   * Loads the open cycle, making it consistent on the way out:
   * - every active member gets an AWAITING contribution row (covers members
   *   added mid-cycle),
   * - the collector pointer is (re)resolved to the first active member, by
   *   position, who hasn't collected yet (covers removed collectors).
   */
  async openCycleState(circle: Circle): Promise<OpenCycleState | null> {
    const open = await this.prisma.cycle.findFirst({
      where: { circleId: circle.id, status: 'OPEN' },
      orderBy: { index: 'desc' },
    });
    if (!open) return null;
    let cycle = open;

    const members = await this.activeMembers(circle.id);

    const existing = await this.prisma.contribution.findMany({
      where: { cycleId: cycle.id },
      select: { membershipId: true },
    });
    const have = new Set(existing.map((c) => c.membershipId));
    const missing = members.filter((m) => !have.has(m.id));
    if (missing.length > 0) {
      await this.prisma.contribution.createMany({
        data: missing.map((m) => ({
          membershipId: m.id,
          cycleId: open.id,
          amountNaira: circle.contributionAmountNaira,
        })),
        skipDuplicates: true,
      });
    }

    const collectedIds = await this.collectedMembershipIds(circle.id);
    const current = open.collectorId
      ? members.find((m) => m.id === open.collectorId)
      : undefined;
    const collector =
      current && !collectedIds.has(current.id)
        ? current
        : (members.find((m) => !collectedIds.has(m.id)) ?? null);
    if ((collector?.id ?? null) !== cycle.collectorId) {
      cycle = await this.prisma.cycle.update({
        where: { id: cycle.id },
        data: { collectorId: collector?.id ?? null },
      });
    }

    return { cycle, members, collectedIds, collector };
  }

  async collectedMembershipIds(circleId: string): Promise<Set<string>> {
    const payouts = await this.prisma.payout.findMany({
      where: { status: 'COMPLETED', cycle: { circleId } },
      select: { collectorId: true },
    });
    return new Set(payouts.map((p) => p.collectorId));
  }

  /** Sum of PAID contributions for a cycle — the pot, as a computed figure. */
  async potNaira(cycleId: string): Promise<number> {
    const paid = await this.prisma.contribution.aggregate({
      where: { cycleId, status: 'PAID', membership: { status: 'ACTIVE' } },
      _sum: { amountNaira: true },
    });
    return paid._sum.amountNaira ?? 0;
  }

  async list(coordinatorId: string): Promise<CircleSummary[]> {
    const circles = await this.prisma.circle.findMany({
      where: { coordinatorId },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(circles.map((c) => this.summarize(c)));
  }

  async create(
    coordinatorId: string,
    dto: CreateCircleDto,
  ): Promise<CircleSummary> {
    const circle = await this.prisma.circle.create({
      data: {
        name: dto.name,
        contributionAmountNaira: dto.amountNaira,
        frequency: dto.frequency,
        memberTarget: dto.memberTarget,
        coordinatorId,
      },
    });
    await this.prisma.cycle.create({
      data: { circleId: circle.id, index: 1 },
    });
    return this.summarize(circle);
  }

  async detail(circleId: string, coordinatorId: string): Promise<CircleDetail> {
    const circle = await this.assertOwned(circleId, coordinatorId);
    const state = await this.openCycleState(circle);
    const members = state?.members ?? (await this.activeMembers(circle.id));
    const collectedIds =
      state?.collectedIds ?? (await this.collectedMembershipIds(circle.id));

    let cycleInfo: ActiveCycleInfo | null = null;
    let paidCount = 0;
    let owingCount = 0;
    if (state) {
      const rows = await this.prisma.contribution.findMany({
        where: { cycleId: state.cycle.id, membership: { status: 'ACTIVE' } },
        include: { membership: true, reviewedBy: true },
      });
      rows.sort((a, b) => a.membership.position - b.membership.position);
      paidCount = rows.filter((r) => r.status === 'PAID').length;
      owingCount = rows.length - paidCount;
      const payout = await this.prisma.payout.findUnique({
        where: { cycleId: state.cycle.id },
      });
      cycleInfo = {
        id: state.cycle.id,
        index: state.cycle.index,
        status: state.cycle.status,
        startedAt: state.cycle.startedAt,
        collector: state.collector
          ? this.toMemberInfo(state.collector, collectedIds)
          : null,
        potNaira: rows
          .filter((r) => r.status === 'PAID')
          .reduce((sum, r) => sum + r.amountNaira, 0),
        expectedNaira: circle.contributionAmountNaira * members.length,
        contributions: rows.map((r) => this.toContributionInfo(r)),
        payout: payout ? this.toPayoutInfo(payout) : null,
      };
    }

    return {
      circle: {
        id: circle.id,
        name: circle.name,
        amountNaira: circle.contributionAmountNaira,
        frequency: circle.frequency,
        status: circle.status,
        memberTarget: circle.memberTarget,
        activeMembers: members.length,
        currentCycleIndex: cycleInfo?.index ?? null,
        paidCount,
        owingCount,
        nextCollectorName: cycleInfo?.collector?.name ?? null,
        createdAt: circle.createdAt,
      },
      inviteToken: circle.inviteToken,
      members: members.map((m) => this.toMemberInfo(m, collectedIds)),
      cycle: cycleInfo,
    };
  }

  private async summarize(circle: Circle): Promise<CircleSummary> {
    const state = await this.openCycleState(circle);
    const activeMembers = state
      ? state.members.length
      : await this.prisma.membership.count({
          where: { circleId: circle.id, status: 'ACTIVE' },
        });

    let paidCount = 0;
    let owingCount = 0;
    if (state) {
      const rows = await this.prisma.contribution.findMany({
        where: { cycleId: state.cycle.id, membership: { status: 'ACTIVE' } },
        select: { status: true },
      });
      paidCount = rows.filter((r) => r.status === 'PAID').length;
      owingCount = rows.length - paidCount;
    }

    return {
      id: circle.id,
      name: circle.name,
      amountNaira: circle.contributionAmountNaira,
      frequency: circle.frequency,
      status: circle.status,
      memberTarget: circle.memberTarget,
      activeMembers,
      currentCycleIndex: state?.cycle.index ?? null,
      paidCount,
      owingCount,
      nextCollectorName: state?.collector?.name ?? null,
      createdAt: circle.createdAt,
    };
  }

  toMemberInfo(m: Membership, collectedIds: Set<string>): MemberInfo {
    return {
      id: m.id,
      name: m.name,
      phone: m.phone,
      position: m.position,
      status: m.status,
      userId: m.userId,
      hasCollected: collectedIds.has(m.id),
    };
  }

  toContributionInfo(
    c: Contribution & { membership: Membership; reviewedBy: User | null },
  ): ContributionInfo {
    return {
      id: c.id,
      membershipId: c.membershipId,
      memberName: c.membership.name,
      memberPhone: c.membership.phone,
      position: c.membership.position,
      amountNaira: c.amountNaira,
      status: c.status,
      receiptFileUrl: c.receiptFileUrl,
      rejectionReason: c.rejectionReason,
      reviewedByName: c.reviewedBy?.name ?? null,
      reviewedAt: c.reviewedAt,
      updatedAt: c.updatedAt,
    };
  }

  toPayoutInfo(p: Payout): PayoutInfo {
    return {
      id: p.id,
      status: p.status,
      amountNaira: p.amountNaira,
      receiptFileUrl: p.receiptFileUrl,
      completedAt: p.completedAt,
    };
  }
}
