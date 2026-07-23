/**
 * Member dashboard API types — mirrors backend/src/member/member.types.ts and
 * the AppealInfo shape in backend/src/circles/circles.types.ts. The apps are
 * independent packages, so keep this file in sync with the backend by hand.
 * Auth shapes are shared with the other consoles via lib/admin/types.
 */

export type {
  LoginResponse,
  OtpSentResponse,
  ProfileInput,
  SafeUser,
} from "../admin/types";
export type {
  CircleFrequency,
  CircleStatus,
  ContributionStatus,
  InvitePreview,
  PayoutAccount,
  PayoutStatus,
} from "../dashboard/types";
import type { PayoutAccount } from "../dashboard/types";

import type {
  CircleFrequency,
  CircleStatus,
  ContributionStatus,
  PayoutStatus,
} from "../dashboard/types";

export type AppealStatus = "OPEN" | "APPROVED" | "REJECTED" | "WITHDRAWN";
export type VoteValue = "SUPPORT" | "OPPOSE";
export type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

/** A pending circle invite the member can accept or decline from their home. */
export interface CircleInvite {
  membershipId: string;
  circleId: string;
  circleName: string;
  amountNaira: number;
  frequency: CircleFrequency;
  coordinatorName: string;
  invitedAt: string;
}

/** The member's own "become a collector" request, as shown on their home. */
export interface MyCollectorApplication {
  id: string;
  status: ApplicationStatus;
  note: string | null;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

/** One card on the member's home screen — their view of one circle. */
export interface MyCircleCard {
  circleId: string;
  circleName: string;
  amountNaira: number;
  frequency: CircleFrequency;
  circleStatus: CircleStatus;
  membershipId: string;
  myPosition: number;
  cycleIndex: number | null;
  /** This round's contribution deadline (the pay-by day); null when no cycle
   *  is open. */
  dueAt: string | null;
  /** My contribution status this cycle; null when no cycle is open. */
  myStatus: ContributionStatus | null;
  myRejectionReason: string | null;
  collectorName: string | null;
  /** It's my turn to collect right now. */
  iCollectNow: boolean;
  /** 0 = collecting now, 1 = next, …; null once I've collected (or no queue). */
  turnsUntilCollect: number | null;
  hasCollected: boolean;
  paidCount: number;
  memberCount: number;
  openAppeals: number;
}

/** One installment paid toward a contribution/payout, visible to everyone. */
export interface MemberReceipt {
  id: string;
  amountNaira: number;
  receiptFileUrl: string;
  uploadedByName: string | null;
  note: string | null;
  createdAt: string;
}

/** A fellow member's row — no phone numbers, just the shared record. */
export interface MemberRow {
  membershipId: string;
  name: string;
  position: number;
  isMe: boolean;
  hasCollected: boolean;
  status: ContributionStatus | null;
  /** Paid so far this cycle (sum of their installment receipts). */
  paidNaira: number;
  /** Latest receipt image (mirror of the newest in `receipts`). */
  receiptFileUrl: string | null;
  /** Everyone's receipts for the week — visible to the whole circle. */
  receipts: MemberReceipt[];
}

export interface RotationSlot {
  name: string;
  position: number;
  isMe: boolean;
}

export interface MyContribution {
  contributionId: string | null;
  status: ContributionStatus | null;
  amountNaira: number;
  paidNaira: number;
  receiptFileUrl: string | null;
  receipts: MemberReceipt[];
  rejectionReason: string | null;
}

/** The current cycle's payout, shown to every member for transparency. */
export interface MemberPayout {
  status: PayoutStatus;
  amountNaira: number;
  /** The coordinator's cut of the pot. */
  feeNaira: number;
  /** What the collector actually receives: pot − fee. */
  netPayoutNaira: number;
  paidNaira: number;
  collectorName: string | null;
  receipts: MemberReceipt[];
  completedAt: string | null;
}

export interface MemberCircleDetail {
  circleId: string;
  circleName: string;
  amountNaira: number;
  frequency: CircleFrequency;
  circleStatus: CircleStatus;
  coordinatorName: string;
  /** The coordinator's account — where members send contributions. */
  coordinatorAccount: PayoutAccount | null;
  /** The coordinator's cut as a whole percent — visible to every member. */
  coordinatorFeePercent: number;
  memberTarget: number;
  cycleIndex: number | null;
  /** This round's contribution deadline (ISO, WAT), or null. */
  dueAt: string | null;
  collector: RotationSlot | null;
  /** Who collects after the current turn, in order (excludes the collector). */
  upcoming: RotationSlot[];
  members: MemberRow[];
  /** This cycle's payout (proof the collector was paid), or null if none yet. */
  payout: MemberPayout | null;
  potNaira: number;
  expectedNaira: number;
  me: {
    membershipId: string;
    position: number;
    hasCollected: boolean;
    turnsUntilCollect: number | null;
    contribution: MyContribution;
  };
}

/**
 * An appeal ("consider me to collect next") — reason, live tally and outcome
 * are visible to everyone in the circle. Voting is advisory; the coordinator
 * decides.
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
  createdAt: string;
  decidedByName: string | null;
  decidedAt: string | null;
  outcomeNote: string | null;
}
