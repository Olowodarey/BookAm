import type {
  ApplicationStatus,
  CircleFrequency,
  CircleStatus,
  ContributionStatus,
} from '@prisma/client';

/**
 * Response shapes for the member (contributor) API. The frontend mirrors
 * these in frontend/lib/member/types.ts — keep the two files in sync by hand.
 *
 * Deliberately leaner than the coordinator shapes: members see names,
 * positions and statuses, but not other members' phone numbers. Amounts are
 * records of money that moved outside BookAm — never balances.
 */

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

/** The member's own "become a collector" request, as shown on their home. */
export interface MyCollectorApplication {
  id: string;
  status: ApplicationStatus;
  note: string | null;
  reviewNote: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}

/** Where to send money OUTSIDE BookAm — display-only profile record. */
export interface PayoutAccount {
  bankName: string | null;
  accountNumber: string;
  accountName: string | null;
  altPhone: string | null;
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
