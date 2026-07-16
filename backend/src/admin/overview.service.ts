import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { OverviewMetrics } from './admin.types';

@Injectable()
export class OverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async metrics(): Promise<OverviewMetrics> {
    const [
      totalUsers,
      totalCoordinators,
      totalCircles,
      pendingApplications,
      activeSubscriptions,
      activeSubs,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'COORDINATOR' } }),
      this.prisma.circle.count(),
      this.prisma.collectorApplication.count({ where: { status: 'PENDING' } }),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        select: { plan: { select: { priceNaira: true } } },
      }),
    ]);

    return {
      totalUsers,
      totalCoordinators,
      totalCircles,
      pendingApplications,
      activeSubscriptions,
      activeRevenueNaira: activeSubs.reduce(
        (sum, s) => sum + s.plan.priceNaira,
        0,
      ),
    };
  }
}
