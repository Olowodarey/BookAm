import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Circle, Cycle, Payout, PayoutReceipt } from '../entities';
import {
  CirclesService,
  payoutRelations,
  type OpenCycleState,
} from './circles.service';
import {
  ReceiptStorageService,
  type ReceiptFile,
} from './receipt-storage.service';
import { resolveReceiptAmount } from './receipt-amount';
import { advanceDeadline } from './schedule';
import type { CompletePayoutResult, PayoutInfo } from './circles.types';

@Injectable()
export class PayoutsService {
  constructor(
    @InjectRepository(Payout) private readonly payouts: Repository<Payout>,
    @InjectRepository(PayoutReceipt)
    private readonly receipts: Repository<PayoutReceipt>,
    @InjectDataSource() private readonly dataSource: DataSource,
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
    amountNaira?: number,
  ): Promise<PayoutInfo> {
    const { state, circle } = await this.openStateWithCollector(
      circleId,
      coordinatorId,
    );
    const receiptFileUrl = await this.storage.save(file, 'payout');
    const pot = await this.circles.potNaira(state.cycle.id);
    const amount = resolveReceiptAmount(amountNaira, pot);

    // Upsert the payout for this cycle (unique on cycleId). save() runs the
    // UUID subscriber; a plain repo.upsert() would bypass it.
    let payout = await this.payouts.findOne({
      where: { cycleId: state.cycle.id },
    });
    if (payout) {
      payout.receiptFileUrl = receiptFileUrl;
      payout.collectorId = state.collector!.id;
    } else {
      payout = this.payouts.create({
        cycleId: state.cycle.id,
        collectorId: state.collector!.id,
        amountNaira: pot,
        receiptFileUrl,
      });
    }
    payout = await this.payouts.save(payout);

    await this.receipts.save(
      this.receipts.create({
        payoutId: payout.id,
        amountNaira: amount,
        receiptFileUrl,
        uploadedById: coordinatorId,
      }),
    );

    const withReceipts = await this.payouts.findOneOrFail({
      where: { id: payout.id },
      relations: payoutRelations,
    });
    return this.circles.toPayoutInfo(
      withReceipts,
      circle.coordinatorFeePercent,
    );
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
    const { state, circle } = await this.openStateWithCollector(
      circleId,
      coordinatorId,
    );
    const existing = await this.payouts.findOne({
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

    const payout = await this.dataSource.transaction(async (manager) => {
      await manager.update(Payout, existing.id, {
        status: 'COMPLETED',
        completedAt: now,
        amountNaira: pot,
        collectorId: collector.id,
      });
      await manager.update(Cycle, state.cycle.id, {
        status: 'COMPLETED',
        completedAt: now,
      });
      if (next) {
        // Carry the schedule forward: the new round's deadline advances by the
        // circle's frequency from this round's deadline.
        const nextDueAt = state.cycle.dueAt
          ? advanceDeadline(state.cycle.dueAt, circle.frequency)
          : null;
        await manager.save(
          manager.create(Cycle, {
            circleId,
            index: state.cycle.index + 1,
            collectorId: next.id,
            ...(nextDueAt ? { dueAt: nextDueAt } : {}),
          }),
        );
      } else {
        await manager.update(Circle, circleId, { status: 'COMPLETED' });
      }
      return manager.findOneOrFail(Payout, {
        where: { id: existing.id },
        relations: payoutRelations,
      });
    });

    return {
      payout: this.circles.toPayoutInfo(payout, circle.coordinatorFeePercent),
      circleStatus: next ? 'ACTIVE' : 'COMPLETED',
      nextCycleIndex: next ? state.cycle.index + 1 : null,
      nextCollectorName: next?.name ?? null,
    };
  }

  private async openStateWithCollector(
    circleId: string,
    coordinatorId: string,
  ): Promise<{ state: OpenCycleState; circle: Circle }> {
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
    return { state, circle };
  }
}
