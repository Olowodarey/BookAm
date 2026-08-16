import { Repository } from 'typeorm';
import { Circle, CollectorApplication, Subscription, User } from '../entities';
import { OverviewService } from './overview.service';

describe('OverviewService', () => {
  let service: OverviewService;
  let users: { count: jest.Mock };
  let circles: { count: jest.Mock };
  let applications: { count: jest.Mock };
  let subscriptions: { count: jest.Mock; find: jest.Mock };

  beforeEach(() => {
    users = { count: jest.fn() };
    circles = { count: jest.fn() };
    applications = { count: jest.fn() };
    subscriptions = { count: jest.fn(), find: jest.fn() };
    service = new OverviewService(
      users as unknown as Repository<User>,
      circles as unknown as Repository<Circle>,
      applications as unknown as Repository<CollectorApplication>,
      subscriptions as unknown as Repository<Subscription>,
    );
  });

  it('aggregates counts and sums revenue over active subscriptions', async () => {
    users.count.mockResolvedValueOnce(120).mockResolvedValueOnce(8);
    circles.count.mockResolvedValue(15);
    applications.count.mockResolvedValue(3);
    subscriptions.count.mockResolvedValue(5);
    subscriptions.find.mockResolvedValue([
      { plan: { priceNaira: 1000 } },
      { plan: { priceNaira: 2500 } },
      { plan: { priceNaira: 500 } },
    ]);

    const result = await service.metrics();

    expect(result).toEqual({
      totalUsers: 120,
      totalCoordinators: 8,
      totalCircles: 15,
      pendingApplications: 3,
      activeSubscriptions: 5,
      activeRevenueNaira: 4000,
    });
  });

  it('reports zero revenue when there are no active subscriptions', async () => {
    users.count.mockResolvedValue(0);
    circles.count.mockResolvedValue(0);
    applications.count.mockResolvedValue(0);
    subscriptions.count.mockResolvedValue(0);
    subscriptions.find.mockResolvedValue([]);

    const result = await service.metrics();

    expect(result.activeRevenueNaira).toBe(0);
    expect(result.activeSubscriptions).toBe(0);
  });
});
