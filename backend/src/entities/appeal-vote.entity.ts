import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { UuidEntity } from './base.entity';
import { VoteValue } from './enums';
import { Appeal } from './appeal.entity';
import { Membership } from './membership.entity';

/** One member's advisory vote on an appeal (changeable until decided). */
@Entity('AppealVote')
@Unique(['appealId', 'voterId'])
export class AppealVote extends UuidEntity {
  @Column({ type: 'uuid' })
  appealId!: string;

  @ManyToOne(() => Appeal, (a) => a.votes)
  @JoinColumn({ name: 'appealId' })
  appeal!: Appeal;

  @Column({ type: 'uuid' })
  voterId!: string;

  @ManyToOne(() => Membership, (m) => m.appealVotes)
  @JoinColumn({ name: 'voterId' })
  voter!: Membership;

  @Column({ type: 'enum', enum: VoteValue })
  value!: VoteValue;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
