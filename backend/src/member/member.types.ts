import type {
  ApplicationStatus,
  CircleFrequency,
  CircleStatus,
  ContributionStatus,
  PayoutStatus,
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

/** One installment paid toward a contribution/payout, visible to everyone. */
export interface MemberReceipt {
  id: string;
  amountNaira: number;
  receiptFileUrl: string;
  uploadedByName: string | null;
  note: string | null;
  createdAt: Date;
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
  /** Everyone's receipts for the week are visible to the whole circle. */
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
  /** How much of amountNaira I've covered so far (sum of my receipts). */
  paidNaira: number;
  receiptFileUrl: string | null;
  receipts: MemberReceipt[];
  rejectionReason: string | null;
}

/** The current cycle's payout, shown to every member for transparency. */
export interface MemberPayout {
  status: PayoutStatus;
  /** The pot figure (sum of PAID contributions). */
  amountNaira: number;
  /** How much the collector has been paid so far (sum of payout receipts). */
  paidNaira: number;
  collectorName: string | null;
  receipts: MemberReceipt[];
  completedAt: Date | null;
}

/** A pending circle invite the member can accept or decline from their home. */
export interface CircleInvite {
  membershipId: string;
  circleId: string;
  circleName: string;
  amountNaira: number;
  frequency: CircleFrequency;
  coordinatorName: string;
  invitedAt: Date;
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
