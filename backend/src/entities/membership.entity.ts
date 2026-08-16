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
import { MembershipStatus } from './enums';
import { Circle } from './circle.entity';
import { User } from './user.entity';
import { Contribution } from './contribution.entity';
import { Payout } from './payout.entity';
import { Cycle } from './cycle.entity';
import { SwapRequest } from './swap-request.entity';

/** An account's place in a Circle. userId links a real account; a coordinator may invite a Gmail with no account yet (userId null). */
@Entity('Membership')
@Index(['circleId'])
@Index(['userId'])
@Index(['invitedEmail'])
export class Membership extends UuidEntity {
  @Column({ type: 'uuid' })
  circleId!: string;

  @ManyToOne(() => Circle, (c) => c.memberships)
  @JoinColumn({ name: 'circleId' })
  circle!: Circle;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user!: User | null;

  @Column()
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', nullable: true })
  invitedEmail!: string | null;

  @Column({ default: 0 })
  position!: number;

  @Column({
    type: 'enum',
    enum: MembershipStatus,
    default: MembershipStatus.INVITED,
  })
  status!: MembershipStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Contribution, (c) => c.membership)
  contributions!: Contribution[];

  @OneToMany(() => Payout, (p) => p.collector)
  payouts!: Payout[];

  @OneToMany(() => Cycle, (c) => c.collector)
  collectingCycles!: Cycle[];

  @OneToMany(() => SwapRequest, (s) => s.requester)
  swapsRequested!: SwapRequest[];

  @OneToMany(() => SwapRequest, (s) => s.target)
  swapsReceived!: SwapRequest[];
}
