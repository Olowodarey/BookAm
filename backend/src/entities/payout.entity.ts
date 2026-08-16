import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  UpdateDateColumn,
} from 'typeorm';
import { UuidEntity } from './base.entity';
import { PayoutStatus } from './enums';
import { Cycle } from './cycle.entity';
import { Membership } from './membership.entity';
import { PayoutReceipt } from './payout-receipt.entity';

/** The record of the pot handed to a cycle's collector (outside BookAm). */
@Entity('Payout')
@Index(['collectorId'])
export class Payout extends UuidEntity {
  @Column({ type: 'uuid', unique: true })
  cycleId!: string;

  @OneToOne(() => Cycle, (c) => c.payout)
  @JoinColumn({ name: 'cycleId' })
  cycle!: Cycle;

  @Column({ type: 'uuid' })
  collectorId!: string;

  @ManyToOne(() => Membership, (m) => m.payouts)
  @JoinColumn({ name: 'collectorId' })
  collector!: Membership;

  @Column()
  amountNaira!: number;

  @Column({ type: 'enum', enum: PayoutStatus, default: PayoutStatus.PENDING })
  status!: PayoutStatus;

  @Column({ type: 'varchar', nullable: true })
  receiptFileUrl!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => PayoutReceipt, (r) => r.payout)
  receipts!: PayoutReceipt[];
}
