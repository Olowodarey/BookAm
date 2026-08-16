import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  Unique,
} from 'typeorm';
import { UuidEntity } from './base.entity';
import { CycleStatus } from './enums';
import { Circle } from './circle.entity';
import { Membership } from './membership.entity';
import { Contribution } from './contribution.entity';
import { Payout } from './payout.entity';

/** One payout round within a circle. `index` is the 1-based turn number. */
@Entity('Cycle')
@Unique(['circleId', 'index'])
@Index(['circleId', 'status'])
export class Cycle extends UuidEntity {
  @Column({ type: 'uuid' })
  circleId!: string;

  @ManyToOne(() => Circle, (c) => c.cycles)
  @JoinColumn({ name: 'circleId' })
  circle!: Circle;

  @Column()
  index!: number;

  @Column({ type: 'enum', enum: CycleStatus, default: CycleStatus.OPEN })
  status!: CycleStatus;

  @Column({ type: 'uuid', nullable: true })
  collectorId!: string | null;

  @ManyToOne(() => Membership, (m) => m.collectingCycles, { nullable: true })
  @JoinColumn({ name: 'collectorId' })
  collector!: Membership | null;

  // Settable (a circle can start on a future date), so a plain column with a
  // now() default rather than @CreateDateColumn (which would ignore manual sets).
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  startedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  dueAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @OneToMany(() => Contribution, (c) => c.cycle)
  contributions!: Contribution[];

  @OneToOne(() => Payout, (p) => p.cycle)
  payout!: Payout | null;
}
