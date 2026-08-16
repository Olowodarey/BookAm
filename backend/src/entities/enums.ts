// Domain enums, mirroring the former Prisma schema exactly. Each is a runtime
// `const` object AND a same-named string-union type (declaration merging), just
// like Prisma's generated enums — so `status === 'ACTIVE'` stays valid and the
// values double as TypeORM `@Column({ type: 'enum', enum: X })` and
// class-validator `@IsEnum(X)` inputs. Backed by native Postgres enum types.

export const Role = {
  MEMBER: 'MEMBER',
  COORDINATOR: 'COORDINATOR',
  ADMIN: 'ADMIN',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const ApplicationStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type ApplicationStatus =
  (typeof ApplicationStatus)[keyof typeof ApplicationStatus];

export const BillingInterval = {
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  YEARLY: 'YEARLY',
} as const;
export type BillingInterval =
  (typeof BillingInterval)[keyof typeof BillingInterval];

export const SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;
export type SubscriptionStatus =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const CircleFrequency = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
} as const;
export type CircleFrequency =
  (typeof CircleFrequency)[keyof typeof CircleFrequency];

export const CircleStatus = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  PAUSED: 'PAUSED',
} as const;
export type CircleStatus = (typeof CircleStatus)[keyof typeof CircleStatus];

export const MembershipStatus = {
  INVITED: 'INVITED',
  REQUESTED: 'REQUESTED',
  ACTIVE: 'ACTIVE',
  REMOVED: 'REMOVED',
} as const;
export type MembershipStatus =
  (typeof MembershipStatus)[keyof typeof MembershipStatus];

export const CycleStatus = {
  OPEN: 'OPEN',
  COMPLETED: 'COMPLETED',
} as const;
export type CycleStatus = (typeof CycleStatus)[keyof typeof CycleStatus];

export const ContributionStatus = {
  AWAITING: 'AWAITING',
  PENDING_REVIEW: 'PENDING_REVIEW',
  PAID: 'PAID',
  REJECTED: 'REJECTED',
} as const;
export type ContributionStatus =
  (typeof ContributionStatus)[keyof typeof ContributionStatus];

export const PayoutStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
} as const;
export type PayoutStatus = (typeof PayoutStatus)[keyof typeof PayoutStatus];

export const SwapStatus = {
  // Awaiting the target member's response.
  PENDING: 'PENDING',
  // Target agreed; awaiting the coordinator's confirmation.
  ACCEPTED: 'ACCEPTED',
  // Coordinator confirmed — the two positions have been swapped (success).
  CONFIRMED: 'CONFIRMED',
  // Target said no.
  DECLINED: 'DECLINED',
  // Requester withdrew before it resolved.
  CANCELLED: 'CANCELLED',
  // Coordinator declined after the target had accepted.
  REJECTED: 'REJECTED',
} as const;
export type SwapStatus = (typeof SwapStatus)[keyof typeof SwapStatus];
