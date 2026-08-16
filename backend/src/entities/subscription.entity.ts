import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { UuidEntity } from './base.entity';
import { SubscriptionStatus } from './enums';
import { User } from './user.entity';
import { SubscriptionPlan } from './subscription-plan.entity';

@Entity('Subscription')
@Index(['userId'])
@Index(['status'])
export class Subscription extends UuidEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid' })
  planId!: string;

  @ManyToOne(() => SubscriptionPlan)
  @JoinColumn({ name: 'planId' })
  plan!: SubscriptionPlan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status!: SubscriptionStatus;

  @Column({ type: 'timestamp' })
  periodStart!: Date;

  @Column({ type: 'timestamp' })
  periodEnd!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
