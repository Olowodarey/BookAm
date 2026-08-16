import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { UuidEntity } from './base.entity';

/** One-time codes for phone verification. Codes stored hashed; sending happens outside the DB. */
@Entity('PhoneOtp')
@Index(['phone', 'createdAt'])
export class PhoneOtp extends UuidEntity {
  @Column()
  phone!: string;

  @Column()
  codeHash!: string;

  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  @Column({ default: 0 })
  attempts!: number;

  @Column({ type: 'timestamp', nullable: true })
  consumedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
