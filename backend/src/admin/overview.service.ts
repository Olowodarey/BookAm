import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Circle, CollectorApplication, Subscription, User } from '../entities';
import type { OverviewMetrics } from './admin.types';

@Injectable()
export class OverviewService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Circle) private readonly circles: Repository<Circle>,
    @InjectRepository(CollectorApplication)
    private readonly applications: Repository<CollectorApplication>,
    @InjectRepository(Subscription)
    private readonly subscriptions: Repository<Subscription>,
  ) {}

  async metrics(): Promise<OverviewMetrics> {
    const [
      totalUsers,
      totalCoordinators,
      totalCircles,
      pendingApplications,
      activeSubscriptions,
      activeSubs,
    ] = await Promise.all([
      this.users.count(),
      this.users.count({ where: { role: 'COORDINATOR' } }),
      this.circles.count(),
      this.applications.count({ where: { status: 'PENDING' } }),
      this.subscriptions.count({ where: { status: 'ACTIVE' } }),
      this.subscriptions.find({
        where: { status: 'ACTIVE' },
        relations: { plan: true },
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
