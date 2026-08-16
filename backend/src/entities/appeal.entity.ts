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
import { AppealStatus } from './enums';
import { Circle } from './circle.entity';
import { Membership } from './membership.entity';
import { User } from './user.entity';
import { AppealVote } from './appeal-vote.entity';

/** A member's request to collect next. Voting is advisory; the coordinator decides. */
@Entity('Appeal')
@Index(['circleId', 'status'])
@Index(['appellantId'])
export class Appeal extends UuidEntity {
  @Column({ type: 'uuid' })
  circleId!: string;

  @ManyToOne(() => Circle, (c) => c.appeals)
  @JoinColumn({ name: 'circleId' })
  circle!: Circle;

  @Column({ type: 'uuid' })
  appellantId!: string;

  @ManyToOne(() => Membership, (m) => m.appeals)
  @JoinColumn({ name: 'appellantId' })
  appellant!: Membership;

  @Column()
  reason!: string;

  @Column({ type: 'enum', enum: AppealStatus, default: AppealStatus.OPEN })
  status!: AppealStatus;

  @Column({ type: 'uuid', nullable: true })
  decidedById!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'decidedById' })
  decidedBy!: User | null;

  @Column({ type: 'timestamp', nullable: true })
  decidedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  outcomeNote!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => AppealVote, (v) => v.appeal)
  votes!: AppealVote[];
}
