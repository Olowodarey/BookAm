import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { UuidEntity } from './base.entity';
import { ContributionStatus } from './enums';
import { Membership } from './membership.entity';
import { Cycle } from './cycle.entity';
import { User } from './user.entity';
import { ContributionReceipt } from './contribution-receipt.entity';

/** A member's payment record for a cycle. A record only — no funds move through BookAm. */
@Entity('Contribution')
@Unique(['membershipId', 'cycleId'])
@Index(['cycleId', 'status'])
export class Contribution extends UuidEntity {
  @Column({ type: 'uuid' })
  membershipId!: string;

  @ManyToOne(() => Membership, (m) => m.contributions)
  @JoinColumn({ name: 'membershipId' })
  membership!: Membership;

  @Column({ type: 'uuid' })
  cycleId!: string;

  @ManyToOne(() => Cycle, (c) => c.contributions)
  @JoinColumn({ name: 'cycleId' })
  cycle!: Cycle;

  @Column()
  amountNaira!: number;

  @Column({
    type: 'enum',
    enum: ContributionStatus,
    default: ContributionStatus.AWAITING,
  })
  status!: ContributionStatus;

  @Column({ type: 'varchar', nullable: true })
  receiptFileUrl!: string | null;

  @Column({ type: 'varchar', nullable: true })
  rejectionReason!: string | null;

  @Column({ type: 'uuid', nullable: true })
  reviewedById!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy!: User | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => ContributionReceipt, (r) => r.contribution)
  receipts!: ContributionReceipt[];
}
