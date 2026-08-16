import { User } from './user.entity';
import { CollectorApplication } from './collector-application.entity';
import { SubscriptionPlan } from './subscription-plan.entity';
import { Subscription } from './subscription.entity';
import { Circle } from './circle.entity';
import { Membership } from './membership.entity';
import { Cycle } from './cycle.entity';
import { Contribution } from './contribution.entity';
import { Payout } from './payout.entity';
import { ContributionReceipt } from './contribution-receipt.entity';
import { PayoutReceipt } from './payout-receipt.entity';
import { PhoneOtp } from './phone-otp.entity';
import { EmailOtp } from './email-otp.entity';
import { Appeal } from './appeal.entity';
import { AppealVote } from './appeal-vote.entity';
import { WaitlistEntry } from './waitlist-entry.entity';
import { PlatformSettings } from './platform-settings.entity';

export * from './enums';
export {
  User,
  CollectorApplication,
  SubscriptionPlan,
  Subscription,
  Circle,
  Membership,
  Cycle,
  Contribution,
  Payout,
  ContributionReceipt,
  PayoutReceipt,
  PhoneOtp,
  EmailOtp,
  Appeal,
  AppealVote,
  WaitlistEntry,
  PlatformSettings,
};

/** Every entity, for TypeORM DataSource / TypeOrmModule registration. */
export const entities = [
  User,
  CollectorApplication,
  SubscriptionPlan,
  Subscription,
  Circle,
  Membership,
  Cycle,
  Contribution,
  Payout,
  ContributionReceipt,
  PayoutReceipt,
  PhoneOtp,
  EmailOtp,
  Appeal,
  AppealVote,
  WaitlistEntry,
  PlatformSettings,
];
