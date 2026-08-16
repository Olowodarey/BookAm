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
import { SwapStatus } from './enums';
import { Circle } from './circle.entity';
import { Membership } from './membership.entity';
import { User } from './user.entity';

/**
 * A member's request to swap rotation positions with another member. The flow:
 * requester creates it → target accepts (or declines) → coordinator confirms (or
 * rejects). On confirmation the two memberships' `position` values are swapped.
 * Everything stays visible as a shared record.
 */
@Entity('SwapRequest')
@Index(['circleId', 'status'])
@Index(['requesterId'])
@Index(['targetId'])
export class SwapRequest extends UuidEntity {
  @Column({ type: 'uuid' })
  circleId!: string;

  @ManyToOne(() => Circle, (c) => c.swapRequests)
  @JoinColumn({ name: 'circleId' })
  circle!: Circle;

  @Column({ type: 'uuid' })
  requesterId!: string;

  @ManyToOne(() => Membership, (m) => m.swapsRequested)
  @JoinColumn({ name: 'requesterId' })
  requester!: Membership;

  @Column({ type: 'uuid' })
  targetId!: string;

  @ManyToOne(() => Membership, (m) => m.swapsReceived)
  @JoinColumn({ name: 'targetId' })
  target!: Membership;

  @Column({ type: 'enum', enum: SwapStatus, default: SwapStatus.PENDING })
  status!: SwapStatus;

  // Optional short reason the requester adds, shown to the target + coordinator.
  @Column({ type: 'varchar', nullable: true })
  note!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  targetRespondedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  coordinatorId!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'coordinatorId' })
  coordinator!: User | null;

  @Column({ type: 'timestamp', nullable: true })
  decidedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
