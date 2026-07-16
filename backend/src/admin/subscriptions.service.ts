import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { Paginated, SubscriptionWithRelations } from './admin.types';
import type { ListSubscriptionsDto } from './dto/query.dto';
import { safeUserSelect } from './safe-user.select';

// TODO: Paystack — when charge collection is integrated, subscriptions will be
// created/renewed from verified Paystack transactions (webhook → create record,
// set periodStart/periodEnd). This module only manages the records; BookAm's
// SaaS fees settle in BookAm's own Paystack account and NEVER touch members'
// ajo contributions.

const withRelations = {
  user: { select: safeUserSelect },
  plan: true,
} satisfies Prisma.SubscriptionInclude;

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListSubscriptionsDto,
  ): Promise<Paginated<SubscriptionWithRelations>> {
    const where: Prisma.SubscriptionWhereInput = query.status
      ? { status: query.status }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.subscription.findMany({
        where,
        include: withRelations,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async updateStatus(
    id: string,
    status: SubscriptionStatus,
  ): Promise<SubscriptionWithRelations> {
    const existing = await this.prisma.subscription.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Subscription not found');

    return this.prisma.subscription.update({
      where: { id },
      data: { status },
      include: withRelations,
    });
  }
}
