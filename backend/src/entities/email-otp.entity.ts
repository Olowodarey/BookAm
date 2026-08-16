import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { UuidEntity } from './base.entity';

/** One-time codes for email verification and password reset. Codes stored hashed. */
@Entity('EmailOtp')
@Index(['email', 'createdAt'])
export class EmailOtp extends UuidEntity {
  @Column()
  email!: string;

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
