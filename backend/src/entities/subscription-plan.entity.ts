import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  UpdateDateColumn,
} from 'typeorm';
import { UuidEntity } from './base.entity';
import { BillingInterval } from './enums';

/** A BookAm SaaS plan. priceNaira is BookAm's own fee (charged off-platform), never member ajo money. */
@Entity('SubscriptionPlan')
export class SubscriptionPlan extends UuidEntity {
  @Index({ unique: true })
  @Column()
  name!: string;

  @Column()
  priceNaira!: number;

  @Column({
    type: 'enum',
    enum: BillingInterval,
    default: BillingInterval.MONTHLY,
  })
  interval!: BillingInterval;

  @Column({ type: 'int', nullable: true })
  maxCircles!: number | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  features!: string[];

  @Column({ default: true })
  active!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
