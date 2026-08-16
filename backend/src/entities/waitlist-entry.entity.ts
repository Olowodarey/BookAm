import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { UuidEntity } from './base.entity';

/** Landing-page early-access signups — just an email, captured before any account exists. */
@Entity('WaitlistEntry')
@Index(['createdAt'])
export class WaitlistEntry extends UuidEntity {
  @Index({ unique: true })
  @Column()
  email!: string;

  @Column({ type: 'varchar', nullable: true })
  source!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
