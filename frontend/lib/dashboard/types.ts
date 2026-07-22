/**
 * Coordinator dashboard API types — mirrors backend/src/circles/circles.types.ts.
 * The two apps are independent packages, so keep this file in sync with the
 * backend by hand. Auth shapes (SafeUser, LoginResponse) are shared with the
 * admin console and re-used from lib/admin/types.
 *
 * Every amount is a *record* of money that moved outside BookAm — never a
 * balance BookAm holds.
 */

export type {
  LoginResponse,
  OtpSentResponse,
  ProfileInput,
  SafeUser,
} from "../admin/types";

/** Where to send money OUTSIDE BookAm — display-only profile record. */
export interface PayoutAccount {
  bankName: string | null;
  accountNumber: string;
  accountName: string | null;
  altPhone: string | null;
}

export type CircleFrequency = "DAILY" | "WEEKLY" | "MONTHLY";
export type CircleStatus = "ACTIVE" | "COMPLETED" | "PAUSED";
export type MembershipStatus =
  | "INVITED"
  | "REQUESTED"
  | "ACTIVE"
  | "REMOVED";
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
  /** The coordinator's cut as a whole percent of the pot (0–100). */
  coordinatorFeePercent: number;
  /** When the first round begins (ISO, WAT), or null on older circles. */
  startDate: string | null;
  currentCycleIndex: number | null;
  paidCount: number;
  owingCount: number;
  nextCollectorName: string | null;
  createdAt: string;
}

export interface MemberInfo {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  position: number;
  status: MembershipStatus;
  userId: string | null;
  /** Already received a completed payout in this circle. */
  hasCollected: boolean;
}

/** One installment paid toward a contribution or payout, with its receipt. */
export interface ReceiptRecord {
  id: string;
  amountNaira: number;
  receiptFileUrl: string;
  uploadedByName: string | null;
  note: string | null;
  createdAt: string;
}

export interface ContributionInfo {
  id: string;
  membershipId: string;
  memberName: string;
  memberPhone: string | null;
  position: number;
  amountNaira: number;
  status: ContributionStatus;
  /** Sum of installment receipts so far (may be < amountNaira until fully paid). */
  paidNaira: number;
  receiptFileUrl: string | null;
  /** Full installment ledger, oldest first. */
  receipts: ReceiptRecord[];
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
  /** The coordinator's cut of this pot. */
  feeNaira: number;
  /** What the collector actually receives: pot − fee. */
  netPayoutNaira: number;
  /** Sum of installment receipts sent to the collector so far. */
  paidNaira: number;
  receiptFileUrl: string | null;
  receipts: ReceiptRecord[];
  completedAt: string | null;
}

export interface ActiveCycleInfo {
  id: string;
  index: number;
  status: CycleStatus;
  startedAt: string;
  /** This round's contribution deadline (ISO, WAT), or null. */
  dueAt: string | null;
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
  /** People who asked to join via the link — coordinator approves/rejects. */
  pendingRequests: MemberInfo[];
  /** People the coordinator invited by email — awaiting their acceptance. */
  pendingInvites: MemberInfo[];
  /** Whether the coordinator has opted into their own circle's rotation. */
  iAmMember: boolean;
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
  phone: string | null;
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
  /** The coordinator's cut as a whole percent of the pot (0–100). */
  feePercent?: number;
  /** ISO instant (WAT) when the first round begins. */
  startDate?: string;
  /** ISO instant for the first round's deadline. */
  firstDueAt?: string;
}
