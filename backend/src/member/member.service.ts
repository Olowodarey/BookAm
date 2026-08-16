import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Appeal,
  Circle,
  CollectorApplication,
  Contribution,
  ContributionReceipt,
  Cycle,
  Membership,
  Payout,
  User,
} from '../entities';
import {
  CirclesService,
  contributionRelations,
  payoutRelations,
  type ContributionWithRelations,
  type OpenCycleState,
} from '../circles/circles.service';
import {
  ReceiptStorageService,
  type ReceiptFile,
} from '../circles/receipt-storage.service';
import { resolveReceiptAmount } from '../circles/receipt-amount';
import { feeBreakdown } from '../circles/fee';
import type {
  CircleInvite,
  MemberCircleDetail,
  MemberPayout,
  MemberRow,
  MyCircleCard,
  MyCollectorApplication,
  MyContribution,
  MemberRoundMember,
  MemberRoundSummary,
  RotationSlot,
} from './member.types';

/** Receipts arrive unordered from a relation load; show them oldest first. */
function byCreatedAt<T extends { createdAt: Date }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

/**
 * Read-mostly API for ordinary circle members. Every method starts from the
 * caller's own ACTIVE membership (linked by userId), so a member can only
 * ever see circles they belong to — and the single write action they have is
 * uploading their *own* contribution receipt. Verification, membership and
 * rotation changes stay coordinator-only.
 */
@Injectable()
export class MemberService {
  constructor(
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectRepository(Circle) private readonly circleRepo: Repository<Circle>,
    @InjectRepository(Cycle) private readonly cycles: Repository<Cycle>,
    @InjectRepository(Contribution)
    private readonly contributions: Repository<Contribution>,
    @InjectRepository(ContributionReceipt)
    private readonly contributionReceipts: Repository<ContributionReceipt>,
    @InjectRepository(Payout) private readonly payouts: Repository<Payout>,
    @InjectRepository(Appeal) private readonly appeals: Repository<Appeal>,
    @InjectRepository(CollectorApplication)
    private readonly applications: Repository<CollectorApplication>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly circles: CirclesService,
    private readonly storage: ReceiptStorageService,
  ) {}

  /**
   * The caller's active membership in a circle — 404 for strangers and
   * removed members alike, so circle ids can't be probed.
   */
  async requireMembership(
    circleId: string,
    userId: string,
  ): Promise<Membership> {
    const membership = await this.memberships.findOne({
      where: { circleId, userId, status: 'ACTIVE' },
    });
    if (!membership) throw new NotFoundException('Circle not found');
    return membership;
  }

  async myCircles(userId: string): Promise<MyCircleCard[]> {
    const memberships = await this.memberships.find({
      where: { userId, status: 'ACTIVE' },
      relations: { circle: true },
      order: { createdAt: 'ASC' },
    });

    return Promise.all(
      memberships.map(async ({ circle, ...membership }) => {
        const state = await this.circles.openCycleState(circle);
        const contributions = state
          ? await this.cycleContributions(state.cycle.id)
          : [];
        const mine =
          contributions.find((c) => c.membershipId === membership.id) ?? null;
        const collected =
          state?.collectedIds ??
          (await this.circles.collectedMembershipIds(circle.id));
        const openAppeals = await this.appeals.count({
          where: { circleId: circle.id, status: 'OPEN' },
        });

        return {
          circleId: circle.id,
          circleName: circle.name,
          amountNaira: circle.contributionAmountNaira,
          frequency: circle.frequency,
          circleStatus: circle.status,
          membershipId: membership.id,
          myPosition: membership.position,
          cycleIndex: state?.cycle.index ?? null,
          dueAt: state?.cycle.dueAt ?? null,
          myStatus: mine?.status ?? null,
          myRejectionReason: mine?.rejectionReason ?? null,
          collectorName: state?.collector?.name ?? null,
          iCollectNow: state?.collector?.id === membership.id,
          turnsUntilCollect: this.turnsUntil(
            membership.id,
            state?.members ?? [],
            collected,
          ),
          hasCollected: collected.has(membership.id),
          paidCount: contributions.filter((c) => c.status === 'PAID').length,
          memberCount: state
            ? state.members.length
            : await this.memberships.count({
                where: { circleId: circle.id, status: 'ACTIVE' },
              }),
          openAppeals,
        };
      }),
    );
  }

  /** Circles this member has been invited to and hasn't accepted yet. */
  async myInvites(userId: string): Promise<CircleInvite[]> {
    const invites = await this.memberships.find({
      where: { userId, status: 'INVITED' },
      relations: { circle: { coordinator: true } },
      order: { createdAt: 'ASC' },
    });
    return invites
      .filter((m) => m.circle.status === 'ACTIVE')
      .map((m) => ({
        membershipId: m.id,
        circleId: m.circleId,
        circleName: m.circle.name,
        amountNaira: m.circle.contributionAmountNaira,
        frequency: m.circle.frequency,
        coordinatorName: m.circle.coordinator.name,
        invitedAt: m.createdAt,
      }));
  }

  /** Accept an invite (INVITED → ACTIVE, joins the rotation). */
  async acceptInvite(
    userId: string,
    membershipId: string,
  ): Promise<{ accepted: true; circleName: string }> {
    const membership = await this.myPendingInvite(userId, membershipId);
    await this.circles.activate(membership.id);
    const circle = await this.circleRepo.findOneByOrFail({
      id: membership.circleId,
    });
    return { accepted: true, circleName: circle.name };
  }

  /** Decline an invite — drops the pending row. */
  async declineInvite(
    userId: string,
    membershipId: string,
  ): Promise<{ declined: true }> {
    const membership = await this.myPendingInvite(userId, membershipId);
    await this.memberships.delete(membership.id);
    return { declined: true };
  }

  private async myPendingInvite(
    userId: string,
    membershipId: string,
  ): Promise<Membership> {
    const membership = await this.memberships.findOne({
      where: { id: membershipId },
    });
    if (
      !membership ||
      membership.userId !== userId ||
      membership.status !== 'INVITED'
    ) {
      throw new NotFoundException('No matching invite');
    }
    return membership;
  }

  async circleDetail(
    circleId: string,
    userId: string,
  ): Promise<MemberCircleDetail> {
    const me = await this.requireMembership(circleId, userId);
    const circle = await this.circleRepo.findOneOrFail({
      where: { id: circleId },
      relations: { coordinator: true },
    });
    const state = await this.circles.openCycleState(circle);
    const members =
      state?.members ?? (await this.circles.activeMembers(circleId));
    const collected =
      state?.collectedIds ??
      (await this.circles.collectedMembershipIds(circleId));
    const contributions = state
      ? await this.cycleContributions(state.cycle.id)
      : [];
    const byMembership = new Map(contributions.map((c) => [c.membershipId, c]));

    const rows: MemberRow[] = members.map((m) => {
      const c = byMembership.get(m.id) ?? null;
      return {
        membershipId: m.id,
        name: m.name,
        position: m.position,
        isMe: m.id === me.id,
        hasCollected: collected.has(m.id),
        status: c?.status ?? null,
        paidNaira: c?.receipts.reduce((sum, r) => sum + r.amountNaira, 0) ?? 0,
        receiptFileUrl: c?.receiptFileUrl ?? null,
        receipts: (c?.receipts ?? []).map((r) =>
          this.circles.toReceiptRecord(r),
        ),
      };
    });

    const payout = state
      ? await this.cyclePayout(
          state.cycle.id,
          state.collector?.name ?? null,
          circle.coordinatorFeePercent,
        )
      : null;

    const queue = members.filter((m) => !collected.has(m.id));
    const collectorId = state?.collector?.id ?? null;
    const upcoming: RotationSlot[] = queue
      .filter((m) => m.id !== collectorId)
      .map((m) => ({
        name: m.name,
        position: m.position,
        isMe: m.id === me.id,
      }));

    const myContribution = byMembership.get(me.id) ?? null;
    const paidSum = contributions
      .filter((c) => c.status === 'PAID')
      .reduce((sum, c) => sum + c.amountNaira, 0);

    return {
      circleId: circle.id,
      circleName: circle.name,
      amountNaira: circle.contributionAmountNaira,
      frequency: circle.frequency,
      circleStatus: circle.status,
      coordinatorName: circle.coordinator.name,
      coordinatorAccount: await this.circles.payoutAccountFor(
        circle.coordinatorId,
      ),
      coordinatorFeePercent: circle.coordinatorFeePercent,
      memberTarget: circle.memberTarget,
      cycleIndex: state?.cycle.index ?? null,
      dueAt: state?.cycle.dueAt ?? null,
      collector: state?.collector
        ? {
            name: state.collector.name,
            position: state.collector.position,
            isMe: state.collector.id === me.id,
          }
        : null,
      upcoming,
      members: rows,
      payout,
      potNaira: paidSum,
      expectedNaira: circle.contributionAmountNaira * members.length,
      me: {
        membershipId: me.id,
        position: me.position,
        hasCollected: collected.has(me.id),
        turnsUntilCollect: this.turnsUntil(me.id, members, collected),
        contribution: this.toMyContribution(myContribution, circle),
      },
    };
  }

  /**
   * The circle's rounds, newest first — who collected, what everyone paid and
   * when, for every round the circle has run (not just the open one). Read-only
   * history so a saver can look back at any past round.
   */
  async circleRounds(
    circleId: string,
    userId: string,
  ): Promise<MemberRoundSummary[]> {
    const me = await this.requireMembership(circleId, userId);
    const cycles = await this.cycles.find({
      where: { circleId },
      order: { index: 'DESC' },
      relations: {
        collector: true,
        contributions: { receipts: { uploadedBy: true }, membership: true },
        payout: { receipts: { uploadedBy: true } },
      },
    });

    return cycles.map((cycle) => {
      // Only active members count toward a round (TypeORM can't filter a
      // nested relation, so we drop removed members here).
      const contribs = cycle.contributions.filter(
        (c) => c.membership.status === 'ACTIVE',
      );
      const members: MemberRoundMember[] = contribs
        .map((c) => {
          const receipts = byCreatedAt(c.receipts);
          return {
            membershipId: c.membershipId,
            name: c.membership.name,
            position: c.membership.position,
            isMe: c.membershipId === me.id,
            status: c.status,
            paidNaira: receipts.reduce((sum, r) => sum + r.amountNaira, 0),
            // The proof-of-payment ledger — kept as the shared record.
            receipts: receipts.map((r) => this.circles.toReceiptRecord(r)),
          };
        })
        .sort((a, b) => a.position - b.position);

      const paid = contribs.filter((c) => c.status === 'PAID');
      return {
        cycleId: cycle.id,
        index: cycle.index,
        status: cycle.status,
        startedAt: cycle.startedAt,
        dueAt: cycle.dueAt,
        completedAt: cycle.completedAt,
        collectorName: cycle.collector?.name ?? null,
        collectorPosition: cycle.collector?.position ?? null,
        isMyTurn: cycle.collectorId === me.id,
        potNaira: paid.reduce((sum, c) => sum + c.amountNaira, 0),
        paidCount: paid.length,
        memberCount: contribs.length,
        members,
        // Proof the collector was paid the pot (the "amount collected").
        payoutReceipts: cycle.payout
          ? byCreatedAt(cycle.payout.receipts).map((r) =>
              this.circles.toReceiptRecord(r),
            )
          : [],
      };
    });
  }

  /**
   * The member's one write action: attach their own proof-of-payment for the
   * open cycle. Goes to PENDING_REVIEW for the coordinator; re-upload is
   * allowed until the contribution is verified PAID.
   */
  async uploadMyReceipt(
    circleId: string,
    userId: string,
    file: ReceiptFile | undefined,
    amountNaira?: number,
  ): Promise<MyContribution> {
    const me = await this.requireMembership(circleId, userId);
    const circle = await this.circleRepo.findOneByOrFail({ id: circleId });
    const state = await this.circles.openCycleState(circle);
    if (!state) {
      throw new BadRequestException('This circle has no open round');
    }
    const contribution = await this.contributions.findOne({
      where: { membershipId: me.id, cycleId: state.cycle.id },
    });
    if (!contribution) {
      throw new NotFoundException('No contribution slot for this round yet');
    }
    if (contribution.status === 'PAID') {
      throw new ConflictException(
        'This contribution is already verified as paid',
      );
    }
    const receiptFileUrl = await this.storage.save(file, 'contribution');
    const amount = resolveReceiptAmount(amountNaira, contribution.amountNaira);
    await this.contributionReceipts.save(
      this.contributionReceipts.create({
        contributionId: contribution.id,
        amountNaira: amount,
        receiptFileUrl,
        uploadedById: userId,
      }),
    );
    await this.contributions.update(contribution.id, {
      receiptFileUrl,
      status: 'PENDING_REVIEW',
      rejectionReason: null,
    });
    const updated = await this.contributions.findOneOrFail({
      where: { id: contribution.id },
      relations: contributionRelations,
    });
    updated.receipts = byCreatedAt(updated.receipts);
    return this.toMyContribution(updated, circle);
  }

  // ---- Become a collector --------------------------------------------------

  /** The member's latest application to become a collector, if any. */
  async myCollectorApplication(
    userId: string,
  ): Promise<MyCollectorApplication | null> {
    const application = await this.applications.findOne({
      where: { applicantId: userId },
      order: { createdAt: 'DESC' },
    });
    return application ? this.toMyApplication(application) : null;
  }

  /**
   * Contributor → collector starts here: one PENDING application at a time,
   * reviewed by the platform admin (who promotes the role on approval).
   * Applications are submitted from the /become-a-collector page only.
   * // TODO: Paystack — gate this behind an active BookAm subscription once
   * // collector plans become chargeable (see admin/subscriptions.service.ts).
   */
  async applyCollector(
    userId: string,
    note: string,
  ): Promise<MyCollectorApplication> {
    const user = await this.users.findOneByOrFail({ id: userId });
    if (user.role !== 'MEMBER') {
      throw new ConflictException(
        user.role === 'COORDINATOR'
          ? 'You are already a collector'
          : 'This account cannot apply to be a collector',
      );
    }
    const pending = await this.applications.findOne({
      where: { applicantId: userId, status: 'PENDING' },
    });
    if (pending) {
      throw new ConflictException(
        'Your application is already with the admin — hold on for their review',
      );
    }
    const application = await this.applications.save(
      this.applications.create({ applicantId: userId, note }),
    );
    return this.toMyApplication(application);
  }

  private toMyApplication(
    application: CollectorApplication,
  ): MyCollectorApplication {
    return {
      id: application.id,
      status: application.status,
      note: application.note,
      reviewNote: application.reviewNote,
      createdAt: application.createdAt,
      reviewedAt: application.reviewedAt,
    };
  }

  /** Position in the not-yet-collected queue; null once collected or empty. */
  private turnsUntil(
    membershipId: string,
    members: OpenCycleState['members'],
    collected: Set<string>,
  ): number | null {
    if (collected.has(membershipId)) return null;
    const queue = members.filter((m) => !collected.has(m.id));
    const index = queue.findIndex((m) => m.id === membershipId);
    return index === -1 ? null : index;
  }

  private toMyContribution(
    contribution: ContributionWithRelations | null,
    circle: Circle,
  ): MyContribution {
    const receipts = contribution ? byCreatedAt(contribution.receipts) : [];
    return {
      contributionId: contribution?.id ?? null,
      status: contribution?.status ?? null,
      amountNaira: contribution?.amountNaira ?? circle.contributionAmountNaira,
      paidNaira: receipts.reduce((sum, r) => sum + r.amountNaira, 0),
      receiptFileUrl: contribution?.receiptFileUrl ?? null,
      receipts: receipts.map((r) => this.circles.toReceiptRecord(r)),
      rejectionReason: contribution?.rejectionReason ?? null,
    };
  }

  private async cycleContributions(
    cycleId: string,
  ): Promise<ContributionWithRelations[]> {
    const rows = await this.contributions.find({
      where: { cycleId, membership: { status: 'ACTIVE' } },
      relations: contributionRelations,
    });
    for (const c of rows) c.receipts = byCreatedAt(c.receipts);
    return rows;
  }

  /** This cycle's payout with its receipt ledger — visible to every member. */
  private async cyclePayout(
    cycleId: string,
    collectorName: string | null,
    feePercent: number,
  ): Promise<MemberPayout | null> {
    const payout = await this.payouts.findOne({
      where: { cycleId },
      relations: payoutRelations,
    });
    if (!payout) return null;
    const receipts = byCreatedAt(payout.receipts);
    const { feeNaira, netPayoutNaira } = feeBreakdown(
      payout.amountNaira,
      feePercent,
    );
    return {
      status: payout.status,
      amountNaira: payout.amountNaira,
      feeNaira,
      netPayoutNaira,
      paidNaira: receipts.reduce((sum, r) => sum + r.amountNaira, 0),
      collectorName,
      receipts: receipts.map((r) => this.circles.toReceiptRecord(r)),
      completedAt: payout.completedAt,
    };
  }
}
