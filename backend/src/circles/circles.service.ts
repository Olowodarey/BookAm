import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Circle, Cycle, Membership } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { feeBreakdown } from './fee';
import type { CreateCircleDto, UpdateCircleDto } from './dto/circle.dto';
import type {
  ActiveCycleInfo,
  CircleDetail,
  CircleSummary,
  ContributionInfo,
  MemberInfo,
  PayoutAccount,
  PayoutInfo,
  ReceiptRecord,
} from './circles.types';

/** Include the uploader's name on each receipt, oldest first. */
const receiptsInclude = {
  include: { uploadedBy: { select: { name: true } } },
  orderBy: { createdAt: 'asc' },
} as const;

/** Everything toContributionInfo needs — reuse on every contribution fetch. */
export const contributionInclude = {
  membership: true,
  reviewedBy: true,
  receipts: receiptsInclude,
} satisfies Prisma.ContributionInclude;

/** Everything toPayoutInfo needs. */
export const payoutInclude = {
  receipts: receiptsInclude,
} satisfies Prisma.PayoutInclude;

export type ContributionWithRelations = Prisma.ContributionGetPayload<{
  include: typeof contributionInclude;
}>;
export type PayoutWithReceipts = Prisma.PayoutGetPayload<{
  include: typeof payoutInclude;
}>;

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
   * Move a pending membership (INVITED/REQUESTED) into the rotation: append it
   * at the next ACTIVE position. Rejects if the circle is already full.
   */
  async activate(membershipId: string): Promise<void> {
    const membership = await this.prisma.membership.findUniqueOrThrow({
      where: { id: membershipId },
      include: { circle: true },
    });
    const activeCount = await this.prisma.membership.count({
      where: { circleId: membership.circleId, status: 'ACTIVE' },
    });
    if (
      membership.circle.memberTarget > 0 &&
      activeCount >= membership.circle.memberTarget
    ) {
      throw new ConflictException(
        'This circle is already full — the coordinator must make room first',
      );
    }
    const max = await this.prisma.membership.aggregate({
      where: { circleId: membership.circleId, status: 'ACTIVE' },
      _max: { position: true },
    });
    await this.prisma.membership.update({
      where: { id: membershipId },
      data: { status: 'ACTIVE', position: (max._max.position ?? 0) + 1 },
    });
    // Rotation changed — re-resolve the open cycle's collector if needed.
    await this.openCycleState(membership.circle);
  }

  /** The account email for a membership, keyed by membership id. */
  private async memberEmails(
    circleId: string,
  ): Promise<Map<string, string | null>> {
    const rows = await this.prisma.membership.findMany({
      where: { circleId },
      select: { id: true, user: { select: { email: true } } },
    });
    return new Map(rows.map((r) => [r.id, r.user?.email ?? null]));
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
        coordinatorFeePercent: dto.feePercent ?? 0,
        coordinatorId,
      },
    });
    await this.prisma.cycle.create({
      data: { circleId: circle.id, index: 1 },
    });
    return this.summarize(circle);
  }

  /** Coordinator edits circle settings (name, fee percent). */
  async update(
    circleId: string,
    coordinatorId: string,
    dto: UpdateCircleDto,
  ): Promise<CircleSummary> {
    await this.assertOwned(circleId, coordinatorId);
    const circle = await this.prisma.circle.update({
      where: { id: circleId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.feePercent !== undefined
          ? { coordinatorFeePercent: dto.feePercent }
          : {}),
      },
    });
    return this.summarize(circle);
  }

  async detail(circleId: string, coordinatorId: string): Promise<CircleDetail> {
    const circle = await this.assertOwned(circleId, coordinatorId);
    const state = await this.openCycleState(circle);
    const members = state?.members ?? (await this.activeMembers(circle.id));
    const collectedIds =
      state?.collectedIds ?? (await this.collectedMembershipIds(circle.id));
    const emails = await this.memberEmails(circle.id);
    const pending = await this.prisma.membership.findMany({
      where: { circleId: circle.id, status: { in: ['REQUESTED', 'INVITED'] } },
      orderBy: { createdAt: 'asc' },
    });

    let cycleInfo: ActiveCycleInfo | null = null;
    let paidCount = 0;
    let owingCount = 0;
    if (state) {
      const rows = await this.prisma.contribution.findMany({
        where: { cycleId: state.cycle.id, membership: { status: 'ACTIVE' } },
        include: contributionInclude,
      });
      rows.sort((a, b) => a.membership.position - b.membership.position);
      paidCount = rows.filter((r) => r.status === 'PAID').length;
      owingCount = rows.length - paidCount;
      const payout = await this.prisma.payout.findUnique({
        where: { cycleId: state.cycle.id },
        include: payoutInclude,
      });
      cycleInfo = {
        id: state.cycle.id,
        index: state.cycle.index,
        status: state.cycle.status,
        startedAt: state.cycle.startedAt,
        collector: state.collector
          ? this.toMemberInfo(state.collector, collectedIds)
          : null,
        collectorAccount: await this.payoutAccountFor(
          state.collector?.userId ?? null,
        ),
        potNaira: rows
          .filter((r) => r.status === 'PAID')
          .reduce((sum, r) => sum + r.amountNaira, 0),
        expectedNaira: circle.contributionAmountNaira * members.length,
        contributions: rows.map((r) => this.toContributionInfo(r)),
        payout: payout
          ? this.toPayoutInfo(payout, circle.coordinatorFeePercent)
          : null,
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
        coordinatorFeePercent: circle.coordinatorFeePercent,
        currentCycleIndex: cycleInfo?.index ?? null,
        paidCount,
        owingCount,
        nextCollectorName: cycleInfo?.collector?.name ?? null,
        createdAt: circle.createdAt,
      },
      inviteToken: circle.inviteToken,
      members: members.map((m) =>
        this.toMemberInfo(m, collectedIds, emails.get(m.id) ?? null),
      ),
      pendingRequests: pending
        .filter((m) => m.status === 'REQUESTED')
        .map((m) =>
          this.toMemberInfo(m, collectedIds, emails.get(m.id) ?? null),
        ),
      pendingInvites: pending
        .filter((m) => m.status === 'INVITED')
        .map((m) =>
          this.toMemberInfo(m, collectedIds, emails.get(m.id) ?? null),
        ),
      iAmMember: members.some((m) => m.userId === coordinatorId),
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
      coordinatorFeePercent: circle.coordinatorFeePercent,
      currentCycleIndex: state?.cycle.index ?? null,
      paidCount,
      owingCount,
      nextCollectorName: state?.collector?.name ?? null,
      createdAt: circle.createdAt,
    };
  }

  /** Bank details from a linked user's profile — display-only record. */
  async payoutAccountFor(userId: string | null): Promise<PayoutAccount | null> {
    if (!userId) return null;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.bankAccountNumber) return null;
    return {
      bankName: user.bankName,
      accountNumber: user.bankAccountNumber,
      accountName: user.bankAccountName ?? user.name,
      altPhone: user.altPhone,
    };
  }

  toMemberInfo(
    m: Membership,
    collectedIds: Set<string>,
    email: string | null = null,
  ): MemberInfo {
    return {
      id: m.id,
      name: m.name,
      email,
      phone: m.phone,
      position: m.position,
      status: m.status,
      userId: m.userId,
      hasCollected: collectedIds.has(m.id),
    };
  }

  toReceiptRecord(r: {
    id: string;
    amountNaira: number;
    receiptFileUrl: string;
    note: string | null;
    createdAt: Date;
    uploadedBy: { name: string } | null;
  }): ReceiptRecord {
    return {
      id: r.id,
      amountNaira: r.amountNaira,
      receiptFileUrl: r.receiptFileUrl,
      uploadedByName: r.uploadedBy?.name ?? null,
      note: r.note,
      createdAt: r.createdAt,
    };
  }

  toContributionInfo(c: ContributionWithRelations): ContributionInfo {
    return {
      id: c.id,
      membershipId: c.membershipId,
      memberName: c.membership.name,
      memberPhone: c.membership.phone,
      position: c.membership.position,
      amountNaira: c.amountNaira,
      status: c.status,
      paidNaira: c.receipts.reduce((sum, r) => sum + r.amountNaira, 0),
      receiptFileUrl: c.receiptFileUrl,
      receipts: c.receipts.map((r) => this.toReceiptRecord(r)),
      rejectionReason: c.rejectionReason,
      reviewedByName: c.reviewedBy?.name ?? null,
      reviewedAt: c.reviewedAt,
      updatedAt: c.updatedAt,
    };
  }

  toPayoutInfo(p: PayoutWithReceipts, feePercent: number): PayoutInfo {
    const { feeNaira, netPayoutNaira } = feeBreakdown(
      p.amountNaira,
      feePercent,
    );
    return {
      id: p.id,
      status: p.status,
      amountNaira: p.amountNaira,
      feeNaira,
      netPayoutNaira,
      paidNaira: p.receipts.reduce((sum, r) => sum + r.amountNaira, 0),
      receiptFileUrl: p.receiptFileUrl,
      receipts: p.receipts.map((r) => this.toReceiptRecord(r)),
      completedAt: p.completedAt,
    };
  }
}
