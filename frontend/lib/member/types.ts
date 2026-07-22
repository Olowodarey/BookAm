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
  PayoutAccount,
} from "../dashboard/types";
import type { PayoutAccount } from "../dashboard/types";

import type {
  CircleFrequency,
  CircleStatus,
  ContributionStatus,
} from "../dashboard/types";

export type AppealStatus = "OPEN" | "APPROVED" | "REJECTED" | "WITHDRAWN";
export type VoteValue = "SUPPORT" | "OPPOSE";
export type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

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

/** A fellow member's row — no phone numbers, just the shared record. */
export interface MemberRow {
  membershipId: string;
  name: string;
  position: number;
  isMe: boolean;
  hasCollected: boolean;
  status: ContributionStatus | null;
  /** Uploaded receipts are visible to the whole circle (transparency). */
  receiptFileUrl: string | null;
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
  receiptFileUrl: string | null;
  rejectionReason: string | null;
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
  memberTarget: number;
  cycleIndex: number | null;
  collector: RotationSlot | null;
  /** Who collects after the current turn, in order (excludes the collector). */
  upcoming: RotationSlot[];
  members: MemberRow[];
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
