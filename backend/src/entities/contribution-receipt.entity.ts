import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { UuidEntity } from './base.entity';
import { Contribution } from './contribution.entity';
import { User } from './user.entity';

/** One proof-of-payment toward a contribution (installment ledger). Records only. */
@Entity('ContributionReceipt')
@Index(['contributionId'])
export class ContributionReceipt extends UuidEntity {
  @Column({ type: 'uuid' })
  contributionId!: string;

  @ManyToOne(() => Contribution, (c) => c.receipts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contributionId' })
  contribution!: Contribution;

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
