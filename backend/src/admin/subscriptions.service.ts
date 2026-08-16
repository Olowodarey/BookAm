import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Subscription, SubscriptionStatus } from '../entities';
import { toSafeUser } from '../auth/auth.service';
import type { Paginated, SubscriptionWithRelations } from './admin.types';
import type { ListSubscriptionsDto } from './dto/query.dto';

// TODO: Paystack — when charge collection is integrated, subscriptions will be
// created/renewed from verified Paystack transactions (webhook → create record,
// set periodStart/periodEnd). This module only manages the records; BookAm's
// SaaS fees settle in BookAm's own Paystack account and NEVER touch members'
// ajo contributions.

/** Loads the user + plan and strips the user down to a SafeUser (no passwordHash). */
function toWithRelations(s: Subscription): SubscriptionWithRelations {
  const { user, plan, ...rest } = s;
  return { ...rest, user: toSafeUser(user), plan };
}

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptions: Repository<Subscription>,
  ) {}

  async list(
    query: ListSubscriptionsDto,
  ): Promise<Paginated<SubscriptionWithRelations>> {
    const where: FindOptionsWhere<Subscription> = query.status
      ? { status: query.status }
      : {};

    const [items, total] = await this.subscriptions.findAndCount({
      where,
      relations: { user: true, plan: true },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });

    return {
      items: items.map(toWithRelations),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async updateStatus(
    id: string,
    status: SubscriptionStatus,
  ): Promise<SubscriptionWithRelations> {
    const existing = await this.subscriptions.findOne({
      where: { id },
      relations: { user: true, plan: true },
    });
    if (!existing) throw new NotFoundException('Subscription not found');

    existing.status = status;
    await this.subscriptions.save(existing);
    return toWithRelations(existing);
  }
}
