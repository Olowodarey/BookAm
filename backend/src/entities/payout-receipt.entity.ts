import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { UuidEntity } from './base.entity';
import { Payout } from './payout.entity';
import { User } from './user.entity';

/** One proof-of-payment toward a payout (the coordinator paying the collector). */
@Entity('PayoutReceipt')
@Index(['payoutId'])
export class PayoutReceipt extends UuidEntity {
  @Column({ type: 'uuid' })
  payoutId!: string;

  @ManyToOne(() => Payout, (p) => p.receipts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payoutId' })
  payout!: Payout;

  @Column()
  amountNaira!: number;

  @Column()
  receiptFileUrl!: string;

  @Column({ type: 'uuid', nullable: true })
  uploadedById!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'uploadedById' })
  uploadedBy!: User | null;

  @Column({ type: 'varchar', nullable: true })
  note!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
