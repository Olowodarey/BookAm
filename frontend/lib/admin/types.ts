/**
 * Admin API types — mirrors backend/src/admin/admin.types.ts and
 * backend/src/auth/auth.types.ts. The two apps are independent packages, so
 * keep this file in sync with the backend by hand.
 */

export type Role = "MEMBER" | "COORDINATOR" | "ADMIN";
export type UserStatus = "ACTIVE" | "SUSPENDED";
export type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";
export type BillingInterval = "MONTHLY" | "QUARTERLY" | "YEARLY";
export type SubscriptionStatus = "ACTIVE" | "EXPIRED" | "CANCELLED";

export interface SafeUser {
  id: string;
  phone: string;
  name: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
}

export interface LoginResponse {
  accessToken: string;
  user: SafeUser;
}

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

export interface CollectorApplication {
  id: string;
  status: ApplicationStatus;
  note: string | null;
  applicantId: string;
  applicant: SafeUser;
  reviewNote: string | null;
  reviewedById: string | null;
  reviewedBy: SafeUser | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  priceNaira: number;
  interval: BillingInterval;
  maxCircles: number | null;
  features: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  user: SafeUser;
  planId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserDetail extends SafeUser {
  updatedAt: string;
  counts: {
    coordinatedCircles: number;
    subscriptions: number;
    applications: number;
  };
}

export interface PlanInput {
  name: string;
  priceNaira: number;
  interval: BillingInterval;
  maxCircles?: number | null;
  features?: string[];
  active?: boolean;
}
