import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  UpdateDateColumn,
} from 'typeorm';
import { UuidEntity } from './base.entity';
import { Role, UserStatus } from './enums';

/**
 * A BookAm account. Email is the primary identity (one email, one account).
 * Profile bank/phone fields are records only — shown to circles so they know
 * where to send money OUTSIDE BookAm; never used to move funds in-app.
 */
@Entity('User')
export class User extends UuidEntity {
  @Index({ unique: true })
  @Column()
  email!: string;

  @Column()
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  passwordHash!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  emailVerifiedAt!: Date | null;

  @Index({ unique: true, where: '"googleId" IS NOT NULL' })
  @Column({ type: 'varchar', nullable: true })
  googleId!: string | null;

  @Index({ unique: true, where: '"phone" IS NOT NULL' })
  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  phoneVerifiedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  altPhone!: string | null;

  @Column({ type: 'varchar', nullable: true })
  bankName!: string | null;

  @Column({ type: 'varchar', nullable: true })
  bankAccountNumber!: string | null;

  @Column({ type: 'varchar', nullable: true })
  bankAccountName!: string | null;

  @Column({ type: 'enum', enum: Role, default: Role.MEMBER })
  role!: Role;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status!: UserStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
