import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CircleFrequency } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CirclesService } from './circles.service';
import {
  ReceiptStorageService,
  type ReceiptFile,
} from './receipt-storage.service';
import type { ContributionInfo, ReminderInfo } from './circles.types';

const FREQUENCY_LABEL: Record<CircleFrequency, string> = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
};

@Injectable()
export class ContributionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly circles: CirclesService,
    private readonly storage: ReceiptStorageService,
  ) {}

  /**
   * Attach a proof-of-payment receipt to a member's contribution for the open
   * cycle. Moves it to PENDING_REVIEW; the coordinator then verifies/rejects.
   */
  async attachReceipt(
    circleId: string,
    coordinatorId: string,
    contributionId: string,
    file: ReceiptFile | undefined,
  ): Promise<ContributionInfo> {
    const contribution = await this.ownedOpenContribution(
      circleId,
      coordinatorId,
      contributionId,
    );
    if (contribution.status === 'PAID') {
      throw new ConflictException('This contribution is already marked paid');
    }
    const receiptFileUrl = await this.storage.save(file, 'contribution');
    return this.updateAndMap(contributionId, {
      receiptFileUrl,
      status: 'PENDING_REVIEW',
      rejectionReason: null,
    });
  }

  /**
   * Mark a contribution PAID. Works from PENDING_REVIEW (receipt verified)
   * and also straight from AWAITING/REJECTED — that's the coordinator
   * recording a payment they received directly (e.g. cash).
   */
  async verify(
    circleId: string,
    coordinatorId: string,
    contributionId: string,
  ): Promise<ContributionInfo> {
    const contribution = await this.ownedOpenContribution(
      circleId,
      coordinatorId,
      contributionId,
    );
    if (contribution.status === 'PAID') {
      throw new ConflictException('This contribution is already marked paid');
    }
    return this.updateAndMap(contributionId, {
      status: 'PAID',
      rejectionReason: null,
      reviewedById: coordinatorId,
      reviewedAt: new Date(),
    });
  }

  /** Reject a submitted receipt; the member must re-submit a correct one. */
  async reject(
    circleId: string,
    coordinatorId: string,
    contributionId: string,
    reason: string,
  ): Promise<ContributionInfo> {
    const contribution = await this.ownedOpenContribution(
      circleId,
      coordinatorId,
      contributionId,
    );
    if (contribution.status !== 'PENDING_REVIEW') {
      throw new BadRequestException(
        'Only receipts pending review can be rejected',
      );
    }
    return this.updateAndMap(contributionId, {
      status: 'REJECTED',
      rejectionReason: reason,
      reviewedById: coordinatorId,
      reviewedAt: new Date(),
    });
  }

  /**
   * Everyone still owing this cycle plus a ready-to-send nudge message.
   * Members whose receipt is PENDING_REVIEW are waiting on the coordinator,
   * not the other way round, so they are not nudged.
   */
  async reminders(
    circleId: string,
    coordinatorId: string,
  ): Promise<ReminderInfo> {
    const circle = await this.circles.assertOwned(circleId, coordinatorId);
    const state = await this.circles.openCycleState(circle);
    if (!state) {
      throw new BadRequestException('This circle has no open cycle');
    }
    const owing = await this.prisma.contribution.findMany({
      where: {
        cycleId: state.cycle.id,
        status: { in: ['AWAITING', 'REJECTED'] },
        membership: { status: 'ACTIVE' },
      },
      include: { membership: true },
    });
    owing.sort((a, b) => a.membership.position - b.membership.position);

    const amount = `₦${circle.contributionAmountNaira.toLocaleString('en-NG')}`;
    const message =
      `Hello! Friendly reminder from ${circle.name}: your ${FREQUENCY_LABEL[circle.frequency]} ` +
      `contribution of ${amount} for round ${state.cycle.index} never enter. ` +
      `Abeg pay and send your receipt so we fit mark you paid. Thank you! 🙏`;

    // TODO: WhatsApp/SMS integration (e.g. WhatsApp Business API, Termii,
    // Africa's Talking) — for now we return the message + recipients and the
    // coordinator forwards it themselves.
    return {
      circleId: circle.id,
      cycleIndex: state.cycle.index,
      message,
      recipients: owing.map((c) => ({
        membershipId: c.membershipId,
        name: c.membership.name,
        phone: c.membership.phone,
        status: c.status,
      })),
    };
  }

  private async ownedOpenContribution(
    circleId: string,
    coordinatorId: string,
    contributionId: string,
  ) {
    await this.circles.assertOwned(circleId, coordinatorId);
    const contribution = await this.prisma.contribution.findUnique({
      where: { id: contributionId },
      include: { cycle: true, membership: true },
    });
    if (
      !contribution ||
      contribution.cycle.circleId !== circleId ||
      contribution.membership.status !== 'ACTIVE'
    ) {
      throw new NotFoundException('Contribution not found in this circle');
    }
    if (contribution.cycle.status !== 'OPEN') {
      throw new BadRequestException('This cycle is already completed');
    }
    return contribution;
  }

  private async updateAndMap(
    contributionId: string,
    data: Parameters<PrismaService['contribution']['update']>[0]['data'],
  ): Promise<ContributionInfo> {
    const updated = await this.prisma.contribution.update({
      where: { id: contributionId },
      data,
      include: { membership: true, reviewedBy: true },
    });
    return this.circles.toContributionInfo(updated);
  }
}
