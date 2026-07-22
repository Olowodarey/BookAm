import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Circle, Membership } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CirclesService,
  contributionInclude,
  payoutInclude,
  type ContributionWithRelations,
  type OpenCycleState,
} from '../circles/circles.service';
import {
  ReceiptStorageService,
  type ReceiptFile,
} from '../circles/receipt-storage.service';
import { resolveReceiptAmount } from '../circles/receipt-amount';
import type {
  MemberCircleDetail,
  MemberPayout,
  MemberRow,
  MyCircleCard,
  MyCollectorApplication,
  MyContribution,
  RotationSlot,
} from './member.types';

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
    private readonly prisma: PrismaService,
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
    const membership = await this.prisma.membership.findFirst({
      where: { circleId, userId, status: 'ACTIVE' },
    });
    if (!membership) throw new NotFoundException('Circle not found');
    return membership;
  }

  async myCircles(userId: string): Promise<MyCircleCard[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { circle: true },
      orderBy: { createdAt: 'asc' },
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
        const openAppeals = await this.prisma.appeal.count({
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
            : await this.prisma.membership.count({
                where: { circleId: circle.id, status: 'ACTIVE' },
              }),
          openAppeals,
        };
      }),
    );
  }

  async circleDetail(
    circleId: string,
    userId: string,
  ): Promise<MemberCircleDetail> {
    const me = await this.requireMembership(circleId, userId);
    const circle = await this.prisma.circle.findUniqueOrThrow({
      where: { id: circleId },
      include: { coordinator: true },
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
      ? await this.cyclePayout(state.cycle.id, state.collector?.name ?? null)
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
      memberTarget: circle.memberTarget,
      cycleIndex: state?.cycle.index ?? null,
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
    const circle = await this.prisma.circle.findUniqueOrThrow({
      where: { id: circleId },
    });
    const state = await this.circles.openCycleState(circle);
    if (!state) {
      throw new BadRequestException('This circle has no open round');
    }
    const contribution = await this.prisma.contribution.findUnique({
      where: {
        membershipId_cycleId: {
          membershipId: me.id,
          cycleId: state.cycle.id,
        },
      },
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
    await this.prisma.contributionReceipt.create({
      data: {
        contributionId: contribution.id,
        amountNaira: amount,
        receiptFileUrl,
        uploadedById: userId,
      },
    });
    const updated = await this.prisma.contribution.update({
      where: { id: contribution.id },
      data: {
        receiptFileUrl,
        status: 'PENDING_REVIEW',
        rejectionReason: null,
      },
      include: contributionInclude,
    });
    return this.toMyContribution(updated, circle);
  }

  // ---- Become a collector --------------------------------------------------

  /** The member's latest application to become a collector, if any. */
  async myCollectorApplication(
    userId: string,
  ): Promise<MyCollectorApplication | null> {
    const application = await this.prisma.collectorApplication.findFirst({
      where: { applicantId: userId },
      orderBy: { createdAt: 'desc' },
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
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (user.role !== 'MEMBER') {
      throw new ConflictException(
        user.role === 'COORDINATOR'
          ? 'You are already a collector'
          : 'This account cannot apply to be a collector',
      );
    }
    const pending = await this.prisma.collectorApplication.findFirst({
      where: { applicantId: userId, status: 'PENDING' },
    });
    if (pending) {
      throw new ConflictException(
        'Your application is already with the admin — hold on for their review',
      );
    }
    const application = await this.prisma.collectorApplication.create({
      data: { applicantId: userId, note },
    });
    return this.toMyApplication(application);
  }

  private toMyApplication(application: {
    id: string;
    status: MyCollectorApplication['status'];
    note: string | null;
    reviewNote: string | null;
    createdAt: Date;
    reviewedAt: Date | null;
  }): MyCollectorApplication {
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
    return {
      contributionId: contribution?.id ?? null,
      status: contribution?.status ?? null,
      amountNaira: contribution?.amountNaira ?? circle.contributionAmountNaira,
      paidNaira:
        contribution?.receipts.reduce((sum, r) => sum + r.amountNaira, 0) ?? 0,
      receiptFileUrl: contribution?.receiptFileUrl ?? null,
      receipts: (contribution?.receipts ?? []).map((r) =>
        this.circles.toReceiptRecord(r),
      ),
      rejectionReason: contribution?.rejectionReason ?? null,
    };
  }

  private cycleContributions(
    cycleId: string,
  ): Promise<ContributionWithRelations[]> {
    return this.prisma.contribution.findMany({
      where: { cycleId, membership: { status: 'ACTIVE' } },
      include: contributionInclude,
    });
  }

  /** This cycle's payout with its receipt ledger — visible to every member. */
  private async cyclePayout(
    cycleId: string,
    collectorName: string | null,
  ): Promise<MemberPayout | null> {
    const payout = await this.prisma.payout.findUnique({
      where: { cycleId },
      include: payoutInclude,
    });
    if (!payout) return null;
    return {
      status: payout.status,
      amountNaira: payout.amountNaira,
      paidNaira: payout.receipts.reduce((sum, r) => sum + r.amountNaira, 0),
      collectorName,
      receipts: payout.receipts.map((r) => this.circles.toReceiptRecord(r)),
      completedAt: payout.completedAt,
    };
  }
}
