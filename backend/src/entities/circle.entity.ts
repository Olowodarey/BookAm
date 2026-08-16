import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { UuidEntity } from './base.entity';
import { CircleFrequency, CircleStatus } from './enums';
import { User } from './user.entity';
import { Membership } from './membership.entity';
import { Cycle } from './cycle.entity';
import { Appeal } from './appeal.entity';

/** A rotating savings circle (ajo/esusu). Every money field is a label on a record — BookAm never holds the pot. */
@Entity('Circle')
@Index(['coordinatorId'])
export class Circle extends UuidEntity {
  @Column()
  name!: string;

  @Column()
  contributionAmountNaira!: number;

  @Column({ type: 'enum', enum: CircleFrequency })
  frequency!: CircleFrequency;

  @Column({ type: 'enum', enum: CircleStatus, default: CircleStatus.ACTIVE })
  status!: CircleStatus;

  @Column({ default: 0 })
  memberTarget!: number;

  @Column({ default: 0 })
  coordinatorFeePercent!: number;

  @Column({ type: 'timestamp', nullable: true })
  startDate!: Date | null;

  @Index({ unique: true, where: '"inviteToken" IS NOT NULL' })
  @Column({ type: 'varchar', nullable: true })
  inviteToken!: string | null;

  @Column({ type: 'uuid' })
  coordinatorId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'coordinatorId' })
  coordinator!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Membership, (m) => m.circle)
  memberships!: Membership[];

  @OneToMany(() => Cycle, (c) => c.circle)
  cycles!: Cycle[];

  @OneToMany(() => Appeal, (a) => a.circle)
  appeals!: Appeal[];
}
