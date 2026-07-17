import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CirclesService, type OpenCycleState } from './circles.service';
import {
  ReceiptStorageService,
  type ReceiptFile,
} from './receipt-storage.service';
import type { CompletePayoutResult, PayoutInfo } from './circles.types';

@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly circles: CirclesService,
    private readonly storage: ReceiptStorageService,
  ) {}

  /**
   * The coordinator sends the pot to this cycle's collector outside BookAm,
   * then uploads the transfer receipt here as proof.
   */
  async attachReceipt(
    circleId: string,
    coordinatorId: string,
    file: ReceiptFile | undefined,
  ): Promise<PayoutInfo> {
    const state = await this.openStateWithCollector(circleId, coordinatorId);
    const receiptFileUrl = await this.storage.save(file, 'payout');
    const pot = await this.circles.potNaira(state.cycle.id);
    const payout = await this.prisma.payout.upsert({
      where: { cycleId: state.cycle.id },
      create: {
        cycleId: state.cycle.id,
        collectorId: state.collector!.id,
        amountNaira: pot,
        receiptFileUrl,
      },
      update: { receiptFileUrl, collectorId: state.collector!.id },
    });
    return this.circles.toPayoutInfo(payout);
  }

  /**
   * Mark the payout COMPLETED (requires an uploaded receipt), close the
   * cycle, and open the next one with the next collector in the rotation.
   * When everyone has collected, the circle itself is COMPLETED.
   */
  async complete(
    circleId: string,
    coordinatorId: string,
  ): Promise<CompletePayoutResult> {
    const state = await this.openStateWithCollector(circleId, coordinatorId);
    const existing = await this.prisma.payout.findUnique({
      where: { cycleId: state.cycle.id },
    });
    if (!existing?.receiptFileUrl) {
      throw new BadRequestException(
        'Upload the payout receipt before marking it completed',
      );
    }

    const pot = await this.circles.potNaira(state.cycle.id);
    const collector = state.collector!;
    const next =
      state.members.find(
        (m) => !state.collectedIds.has(m.id) && m.id !== collector.id,
      ) ?? null;
    const now = new Date();

    const payout = await this.prisma.$transaction(async (tx) => {
      const completed = await tx.payout.update({
        where: { id: existing.id },
        data: {
          status: 'COMPLETED',
          completedAt: now,
          amountNaira: pot,
          collectorId: collector.id,
        },
      });
      await tx.cycle.update({
        where: { id: state.cycle.id },
        data: { status: 'COMPLETED', completedAt: now },
      });
      if (next) {
        await tx.cycle.create({
          data: {
            circleId,
            index: state.cycle.index + 1,
            collectorId: next.id,
          },
        });
      } else {
        await tx.circle.update({
          where: { id: circleId },
          data: { status: 'COMPLETED' },
        });
      }
      return completed;
    });

    return {
      payout: this.circles.toPayoutInfo(payout),
      circleStatus: next ? 'ACTIVE' : 'COMPLETED',
      nextCycleIndex: next ? state.cycle.index + 1 : null,
      nextCollectorName: next?.name ?? null,
    };
  }

  private async openStateWithCollector(
    circleId: string,
    coordinatorId: string,
  ): Promise<OpenCycleState> {
    const circle = await this.circles.assertOwned(circleId, coordinatorId);
    const state = await this.circles.openCycleState(circle);
    if (!state) {
      throw new BadRequestException('This circle has no open cycle');
    }
    if (!state.collector) {
      throw new BadRequestException(
        'Add members to the circle first — there is nobody to collect yet',
      );
    }
    return state;
  }
}
