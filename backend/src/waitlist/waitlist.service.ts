import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { WaitlistList } from './waitlist.types';

@Injectable()
export class WaitlistService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record an early-access signup. Idempotent: re-submitting the same email is
   * a no-op and never errors, so the form can't be used to probe who's already
   * on the list.
   */
  async join(email: string, source?: string): Promise<{ joined: true }> {
    const normalized = email.trim().toLowerCase();
    await this.prisma.waitlistEntry.upsert({
      where: { email: normalized },
      update: {},
      create: { email: normalized, source: source ?? null },
    });
    return { joined: true };
  }

  /** Admin view: everyone on the list, newest first, with a running total. */
  async list(): Promise<WaitlistList> {
    const [entries, total] = await Promise.all([
      this.prisma.waitlistEntry.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.waitlistEntry.count(),
    ]);
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
