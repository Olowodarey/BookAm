import type {
  AppealStatus,
  CircleFrequency,
  CircleStatus,
  ContributionStatus,
  CycleStatus,
  MembershipStatus,
  PayoutStatus,
  VoteValue,
} from '@prisma/client';

/**
 * Response shapes for the coordinator circles API. The frontend mirrors these
 * in frontend/lib/dashboard/types.ts — keep the two files in sync (the apps
 * are independent packages with no shared workspace).
 *
 * Every amount here is a *record* of money that moved outside BookAm —
 * never a balance BookAm holds.
 */

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
  createdAt: Date;
}

export interface MemberInfo {
  id: string;
  name: string;
  /** The account's email — how the coordinator identifies who to approve. */
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
  createdAt: Date;
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
  /** Latest receipt (mirror of the newest entry in `receipts`). */
  receiptFileUrl: string | null;
  /** Full installment ledger, oldest first — visible to the whole circle. */
  receipts: ReceiptRecord[];
  rejectionReason: string | null;
  reviewedByName: string | null;
  reviewedAt: Date | null;
  updatedAt: Date;
}

/**
 * Where to send someone money OUTSIDE BookAm — copied from their profile
 * settings. Display-only; BookAm never initiates a transfer.
 */
export interface PayoutAccount {
  bankName: string | null;
  accountNumber: string;
  accountName: string | null;
  altPhone: string | null;
}

export interface PayoutInfo {
  id: string;
  status: PayoutStatus;
  /** Computed pot (sum of PAID contributions) — a figure, not a balance. */
  amountNaira: number;
  /** Sum of installment receipts sent to the collector so far. */
  paidNaira: number;
  /** Latest receipt (mirror of the newest entry in `receipts`). */
  receiptFileUrl: string | null;
  /** Full installment ledger, oldest first — visible to the whole circle. */
  receipts: ReceiptRecord[];
  completedAt: Date | null;
}

export interface ActiveCycleInfo {
  id: string;
  index: number;
  status: CycleStatus;
  startedAt: Date;
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
  cycle: ActiveCycleInfo | null;
}

export interface InviteLinkResponse {
  inviteToken: string;
  inviteUrl: string;
}

/** What a prospective member sees when they open an invite link. */
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

/**
 * An appeal ("consider me to collect next") as shown to members and the
 * coordinator alike — reason, live tally and outcome are visible to everyone
 * in the circle. Voting is advisory; the coordinator decides.
 */
export interface AppealInfo {
  id: string;
  circleId: string;
  appellantName: string;
  appellantPosition: number;
  /** True when the viewer is the appellant (enables withdraw, blocks voting). */
  isMine: boolean;
  reason: string;
  status: AppealStatus;
  supportCount: number;
  opposeCount: number;
  /** The viewer's own vote, if any (members only; null for the coordinator). */
  myVote: VoteValue | null;
  /** Viewer may vote right now (open appeal, member, not the appellant). */
  canVote: boolean;
  createdAt: Date;
  decidedByName: string | null;
  decidedAt: Date | null;
  outcomeNote: string | null;
}
