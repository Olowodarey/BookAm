import type {
  CollectorApplication,
  Subscription,
  SubscriptionPlan,
} from '../entities';
import type { SafeUser } from '../auth/auth.types';

/**
 * Response shapes for the admin API. The frontend mirrors these in
 * frontend/lib/admin/types.ts — keep the two files in sync (the apps are
 * independent packages with no shared workspace).
 */

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OverviewMetrics {
  totalUsers: number;
  totalCoordinators: number;
  totalCircles: number;
  pendingApplications: number;
  activeSubscriptions: number;
  /** Sum of plan prices across currently ACTIVE subscriptions (₦). */
  activeRevenueNaira: number;
}

export type ApplicationWithPeople = Omit<
  CollectorApplication,
  'applicant' | 'reviewedBy'
> & {
  applicant: SafeUser;
  reviewedBy: SafeUser | null;
};

export type SubscriptionWithRelations = Omit<Subscription, 'user' | 'plan'> & {
  user: SafeUser;
  plan: SubscriptionPlan;
};

export type UserDetail = SafeUser & {
  updatedAt: Date;
  counts: {
    coordinatedCircles: number;
    subscriptions: number;
    applications: number;
  };
};
