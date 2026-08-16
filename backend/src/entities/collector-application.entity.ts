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
import { ApplicationStatus } from './enums';
import { User } from './user.entity';

/** A member's request to become a coordinator, reviewed by an admin. */
@Entity('CollectorApplication')
@Index(['status'])
@Index(['applicantId'])
export class CollectorApplication extends UuidEntity {
  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.PENDING,
  })
  status!: ApplicationStatus;

  @Column({ type: 'varchar', nullable: true })
  note!: string | null;

  @Column({ type: 'uuid' })
  applicantId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'applicantId' })
  applicant!: User;

  @Column({ type: 'varchar', nullable: true })
  reviewNote!: string | null;

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
}
