import { PrismaService } from '../prisma/prisma.service';
import { OverviewService } from './overview.service';

describe('OverviewService', () => {
  let service: OverviewService;
  let prisma: {
    user: { count: jest.Mock };
    circle: { count: jest.Mock };
    collectorApplication: { count: jest.Mock };
    subscription: { count: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      user: { count: jest.fn() },
      circle: { count: jest.fn() },
      collectorApplication: { count: jest.fn() },
      subscription: { count: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(),
    };
    service = new OverviewService(prisma as unknown as PrismaService);
  });

  it('aggregates counts and sums revenue over active subscriptions', async () => {
    prisma.$transaction.mockResolvedValue([
      120, // totalUsers
      8, // totalCoordinators
      15, // totalCircles
      3, // pendingApplications
      5, // activeSubscriptions
      [
        { plan: { priceNaira: 1000 } },
        { plan: { priceNaira: 2500 } },
        { plan: { priceNaira: 500 } },
      ],
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
    prisma.$transaction.mockResolvedValue([0, 0, 0, 0, 0, []]);

    const result = await service.metrics();

    expect(result.activeRevenueNaira).toBe(0);
    expect(result.activeSubscriptions).toBe(0);
  });
});
