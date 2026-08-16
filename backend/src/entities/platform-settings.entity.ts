import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Platform-wide configuration — a single row (id = 1). Holds the support contact
 * (WhatsApp + email) the admin sets, shown to coordinators and members. This is a
 * config singleton, not a UUID entity, so it keeps a fixed integer id.
 */
@Entity('PlatformSettings')
export class PlatformSettings {
  @PrimaryColumn({ type: 'int', default: 1 })
  id!: number;

  @Column({ type: 'varchar', nullable: true })
  supportWhatsapp!: string | null;

  @Column({ type: 'varchar', nullable: true })
  supportEmail!: string | null;

  @UpdateDateColumn()
  updatedAt!: Date;
}
