/**
 * Coordinator dashboard API types — mirrors backend/src/circles/circles.types.ts.
 * The two apps are independent packages, so keep this file in sync with the
 * backend by hand. Auth shapes (SafeUser, LoginResponse) are shared with the
 * admin console and re-used from lib/admin/types.
 *
 * Every amount is a *record* of money that moved outside BookAm — never a
 * balance BookAm holds.
 */

export type { LoginResponse, ProfileInput, SafeUser } from "../admin/types";

/** Where to send money OUTSIDE BookAm — display-only profile record. */
export interface PayoutAccount {
  bankName: string | null;
  accountNumber: string;
  accountName: string | null;
  altPhone: string | null;
}

export type CircleFrequency = "DAILY" | "WEEKLY" | "MONTHLY";
export type CircleStatus = "ACTIVE" | "COMPLETED" | "PAUSED";
export type MembershipStatus = "ACTIVE" | "REMOVED";
export type CycleStatus = "OPEN" | "COMPLETED";
export type ContributionStatus =
  | "AWAITING"
  | "PENDING_REVIEW"
  | "PAID"
  | "REJECTED";
export type PayoutStatus = "PENDING" | "COMPLETED";

export interface CircleSummary {
  id: string;
  name: string;
  amountNaira: number;
  frequency: CircleFrequency;
  status: CircleStatus;
  /** Planned rotation size set at creation. */
  memberTarget: number;
  /** Actual active members right now. */
  activeMembers: number;
  currentCycleIndex: number | null;
  paidCount: number;
  owingCount: number;
  nextCollectorName: string | null;
  createdAt: string;
}

export interface MemberInfo {
  id: string;
  name: string;
  phone: string;
  position: number;
  status: MembershipStatus;
  userId: string | null;
  /** Already received a completed payout in this circle. */
  hasCollected: boolean;
}

export interface ContributionInfo {
  id: string;
  membershipId: string;
  memberName: string;
  memberPhone: string;
  position: number;
  amountNaira: number;
  status: ContributionStatus;
  receiptFileUrl: string | null;
  rejectionReason: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  updatedAt: string;
}

export interface PayoutInfo {
  id: string;
  status: PayoutStatus;
  /** Computed pot (sum of PAID contributions) — a figure, not a balance. */
  amountNaira: number;
  receiptFileUrl: string | null;
  completedAt: string | null;
}

export interface ActiveCycleInfo {
  id: string;
  index: number;
  status: CycleStatus;
  startedAt: string;
  collector: MemberInfo | null;
  /** The collector's bank details (from their profile), if they set them. */
  collectorAccount: PayoutAccount | null;
  /** Sum of PAID contributions so far this cycle. */
  potNaira: number;
  /** amount × active members — what a full cycle would total. */
  expectedNaira: number;
  contributions: ContributionInfo[];
  payout: PayoutInfo | null;
}

export interface CircleDetail {
  circle: CircleSummary;
  inviteToken: string | null;
  members: MemberInfo[];
  cycle: ActiveCycleInfo | null;
}

export interface InviteLinkResponse {
  inviteToken: string;
  inviteUrl: string;
}

export interface InvitePreview {
  circleName: string;
  coordinatorName: string;
  amountNaira: number;
  frequency: CircleFrequency;
  activeMembers: number;
  memberTarget: number;
}

export interface ReminderRecipient {
  membershipId: string;
  name: string;
  phone: string;
  status: ContributionStatus;
}

export interface ReminderInfo {
  circleId: string;
  cycleIndex: number;
  /** Ready-to-send nudge text for everyone still owing. */
  message: string;
  recipients: ReminderRecipient[];
}

export interface CompletePayoutResult {
  payout: PayoutInfo;
  circleStatus: CircleStatus;
  nextCycleIndex: number | null;
  nextCollectorName: string | null;
}

export interface CreateCircleInput {
  name: string;
  amountNaira: number;
  frequency: CircleFrequency;
  memberTarget: number;
}
