import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, In, Repository } from 'typeorm';
import {
  Circle,
  Contribution,
  Cycle,
  Membership,
  Payout,
  User,
} from '../entities';
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

/** Relations toContributionInfo needs — reuse on every contribution fetch. */
export const contributionRelations: FindOptionsRelations<Contribution> = {
  membership: true,
  reviewedBy: true,
  receipts: { uploadedBy: true },
};

/** Relations toPayoutInfo needs. */
export const payoutRelations: FindOptionsRelations<Payout> = {
  receipts: { uploadedBy: true },
};

export type ContributionWithRelations = Contribution;
export type PayoutWithReceipts = Payout;

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

/** Common shape of a contribution/payout installment receipt row. */
interface ReceiptLike {
  id: string;
  amountNaira: number;
  receiptFileUrl: string;
  note: string | null;
  createdAt: Date;
  uploadedBy: User | null;
}

/** Receipts arrive unordered from a relation load; show them oldest first. */
function sortReceipts<T extends { createdAt: Date }>(receipts: T[]): T[] {
  return [...receipts].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

@Injectable()
export class CirclesService {
  constructor(
    @InjectRepository(Circle) private readonly circles: Repository<Circle>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectRepository(Cycle) private readonly cycles: Repository<Cycle>,
    @InjectRepository(Contribution)
    private readonly contributions: Repository<Contribution>,
    @InjectRepository(Payout) private readonly payouts: Repository<Payout>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /**
   * Every coordinator endpoint goes through this: a circle that doesn't exist
   * and a circle owned by someone else both 404, so ids can't be probed.
   */
  async assertOwned(circleId: string, coordinatorId: string): Promise<Circle> {
    const circle = await this.circles.findOne({ where: { id: circleId } });
    if (!circle || circle.coordinatorId !== coordinatorId) {
      throw new NotFoundException('Circle not found');
    }
    return circle;
  }

  activeMembers(circleId: string): Promise<Membership[]> {
    return this.memberships.find({
      where: { circleId, status: 'ACTIVE' },
      order: { position: 'ASC' },
    });
  }

  /**
   * Move a pending membership (INVITED/REQUESTED) into the rotation: append it
   * at the next ACTIVE position. Rejects if the circle is already full.
   */
  async activate(membershipId: string): Promise<void> {
    const membership = await this.memberships.findOneOrFail({
      where: { id: membershipId },
      relations: { circle: true },
    });
    const activeCount = await this.memberships.count({
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
    const top = await this.memberships.findOne({
      where: { circleId: membership.circleId, status: 'ACTIVE' },
      order: { position: 'DESC' },
    });
    await this.memberships.update(membershipId, {
      status: 'ACTIVE',
      position: (top?.position ?? 0) + 1,
    });
    // Rotation changed — re-resolve the open cycle's collector if needed.
    await this.openCycleState(membership.circle);
  }

  /** The email for a membership (account email, or the invited Gmail). */
  private async memberEmails(
    circleId: string,
  ): Promise<Map<string, string | null>> {
    const rows = await this.memberships.find({
      where: { circleId },
      relations: { user: true },
    });
    return new Map(
      rows.map((r) => [r.id, r.user?.email ?? r.invitedEmail ?? null]),
    );
  }

  /**
   * Loads the open cycle, making it consistent on the way out:
   * - every active member gets an AWAITING contribution row (covers members
   *   added mid-cycle),
   * - the collector pointer is (re)resolved to the first active member, by
   *   position, who hasn't collected yet (covers removed collectors).
   */
  async openCycleState(circle: Circle): Promise<OpenCycleState | null> {
    const cycle = await this.cycles.findOne({
      where: { circleId: circle.id, status: 'OPEN' },
      order: { index: 'DESC' },
    });
    if (!cycle) return null;

    const members = await this.activeMembers(circle.id);

    const existing = await this.contributions.find({
      where: { cycleId: cycle.id },
      select: { membershipId: true },
    });
    const have = new Set(existing.map((c) => c.membershipId));
    const missing = members.filter((m) => !have.has(m.id));
    if (missing.length > 0) {
      await this.contributions.save(
        missing.map((m) =>
          this.contributions.create({
            membershipId: m.id,
            cycleId: cycle.id,
            amountNaira: circle.contributionAmountNaira,
            status: 'AWAITING',
          }),
        ),
      );
    }

    const collectedIds = await this.collectedMembershipIds(circle.id);
    const current = cycle.collectorId
      ? members.find((m) => m.id === cycle.collectorId)
      : undefined;
    const collector =
      current && !collectedIds.has(current.id)
        ? current
        : (members.find((m) => !collectedIds.has(m.id)) ?? null);
    if ((collector?.id ?? null) !== cycle.collectorId) {
      cycle.collectorId = collector?.id ?? null;
      await this.cycles.update(cycle.id, { collectorId: cycle.collectorId });
    }

    return { cycle, members, collectedIds, collector };
  }

  async collectedMembershipIds(circleId: string): Promise<Set<string>> {
    const payouts = await this.payouts.find({
      where: { status: 'COMPLETED', cycle: { circleId } },
      select: { collectorId: true },
    });
    return new Set(payouts.map((p) => p.collectorId));
  }

  /** Sum of PAID contributions for a cycle — the pot, as a computed figure. */
  async potNaira(cycleId: string): Promise<number> {
    const raw = await this.contributions
      .createQueryBuilder('c')
      .innerJoin('c.membership', 'm')
      .select('COALESCE(SUM(c.amountNaira), 0)', 'sum')
      .where('c.cycleId = :cycleId', { cycleId })
      .andWhere('c.status = :status', { status: 'PAID' })
      .andWhere('m.status = :ms', { ms: 'ACTIVE' })
      .getRawOne<{ sum: string }>();
    return Number(raw?.sum ?? 0);
  }

  async list(coordinatorId: string): Promise<CircleSummary[]> {
    const circles = await this.circles.find({
      where: { coordinatorId },
      order: { createdAt: 'DESC' },
    });
    return Promise.all(circles.map((c) => this.summarize(c)));
  }

  async create(
    coordinatorId: string,
    dto: CreateCircleDto,
  ): Promise<CircleSummary> {
    const startDate = dto.startDate ? new Date(dto.startDate) : null;
    const circle = await this.circles.save(
      this.circles.create({
        name: dto.name,
        contributionAmountNaira: dto.amountNaira,
        frequency: dto.frequency,
        memberTarget: dto.memberTarget,
        coordinatorFeePercent: dto.feePercent ?? 0,
        startDate,
        coordinatorId,
      }),
    );
    await this.cycles.save(
      this.cycles.create({
        circleId: circle.id,
        index: 1,
        ...(startDate ? { startedAt: startDate } : {}),
        ...(dto.firstDueAt ? { dueAt: new Date(dto.firstDueAt) } : {}),
      }),
    );
    return this.summarize(circle);
  }

  /** Coordinator edits circle settings (name, fee, schedule). */
  async update(
    circleId: string,
    coordinatorId: string,
    dto: UpdateCircleDto,
  ): Promise<CircleSummary> {
    const circle = await this.assertOwned(circleId, coordinatorId);
    if (dto.name !== undefined) circle.name = dto.name;
    if (dto.feePercent !== undefined) {
      circle.coordinatorFeePercent = dto.feePercent;
    }
    if (dto.startDate !== undefined) circle.startDate = new Date(dto.startDate);
    await this.circles.save(circle);
    // Adjusting the deadline applies to the current open round.
    if (dto.dueAt !== undefined) {
      const open = await this.cycles.findOne({
        where: { circleId, status: 'OPEN' },
        order: { index: 'DESC' },
      });
      if (open) {
        open.dueAt = new Date(dto.dueAt);
        await this.cycles.save(open);
      }
    }
    return this.summarize(circle);
  }

  async detail(circleId: string, coordinatorId: string): Promise<CircleDetail> {
    const circle = await this.assertOwned(circleId, coordinatorId);
    const state = await this.openCycleState(circle);
    const members = state?.members ?? (await this.activeMembers(circle.id));
    const collectedIds =
      state?.collectedIds ?? (await this.collectedMembershipIds(circle.id));
    const emails = await this.memberEmails(circle.id);
    const pending = await this.memberships.find({
      where: { circleId: circle.id, status: In(['REQUESTED', 'INVITED']) },
      order: { createdAt: 'ASC' },
    });

    let cycleInfo: ActiveCycleInfo | null = null;
    let paidCount = 0;
    let owingCount = 0;
    if (state) {
      const rows = await this.contributions.find({
        where: { cycleId: state.cycle.id, membership: { status: 'ACTIVE' } },
        relations: contributionRelations,
      });
      rows.sort((a, b) => a.membership.position - b.membership.position);
      paidCount = rows.filter((r) => r.status === 'PAID').length;
      owingCount = rows.length - paidCount;
      const payout = await this.payouts.findOne({
        where: { cycleId: state.cycle.id },
        relations: payoutRelations,
      });
      cycleInfo = {
        id: state.cycle.id,
        index: state.cycle.index,
        status: state.cycle.status,
        startedAt: state.cycle.startedAt,
        dueAt: state.cycle.dueAt,
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
        startDate: circle.startDate,
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
      : await this.memberships.count({
          where: { circleId: circle.id, status: 'ACTIVE' },
        });

    let paidCount = 0;
    let owingCount = 0;
    if (state) {
      const rows = await this.contributions.find({
        where: { cycleId: state.cycle.id, membership: { status: 'ACTIVE' } },
        relations: { membership: true },
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
      startDate: circle.startDate,
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
    const user = await this.users.findOne({ where: { id: userId } });
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

  toReceiptRecord(r: ReceiptLike): ReceiptRecord {
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
    const receipts = sortReceipts(c.receipts);
    return {
      id: c.id,
      membershipId: c.membershipId,
      memberName: c.membership.name,
      memberPhone: c.membership.phone,
      position: c.membership.position,
      amountNaira: c.amountNaira,
      status: c.status,
      paidNaira: receipts.reduce((sum, r) => sum + r.amountNaira, 0),
      receiptFileUrl: c.receiptFileUrl,
      receipts: receipts.map((r) => this.toReceiptRecord(r)),
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
    const receipts = sortReceipts(p.receipts);
    return {
      id: p.id,
      status: p.status,
      amountNaira: p.amountNaira,
      feeNaira,
      netPayoutNaira,
      paidNaira: receipts.reduce((sum, r) => sum + r.amountNaira, 0),
      receiptFileUrl: p.receiptFileUrl,
      receipts: receipts.map((r) => this.toReceiptRecord(r)),
      completedAt: p.completedAt,
    };
  }
}
