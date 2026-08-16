import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WaitlistEntry } from '../entities';
import { isUniqueViolation } from '../database/db-errors';
import type { WaitlistList } from './waitlist.types';

@Injectable()
export class WaitlistService {
  constructor(
    @InjectRepository(WaitlistEntry)
    private readonly waitlist: Repository<WaitlistEntry>,
  ) {}

  /**
   * Record an early-access signup. Idempotent: re-submitting the same email is
   * a no-op and never errors, so the form can't be used to probe who's already
   * on the list.
   */
  async join(email: string, source?: string): Promise<{ joined: true }> {
    const normalized = email.trim().toLowerCase();
    const existing = await this.waitlist.findOne({
      where: { email: normalized },
    });
    if (!existing) {
      try {
        await this.waitlist.save(
          this.waitlist.create({ email: normalized, source: source ?? null }),
        );
      } catch (e) {
        // Concurrent duplicate signup — the unique index already has it, no-op.
        if (!isUniqueViolation(e)) throw e;
      }
    }
    return { joined: true };
  }

  /** Admin view: everyone on the list, newest first, with a running total. */
  async list(): Promise<WaitlistList> {
    const [entries, total] = await this.waitlist.findAndCount({
      order: { createdAt: 'DESC' },
    });
    return {
      total,
      entries: entries.map((e) => ({
        id: e.id,
        email: e.email,
        source: e.source,
        createdAt: e.createdAt,
      })),
    };
  }
}
