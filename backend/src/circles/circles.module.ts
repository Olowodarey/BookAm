import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Circle,
  Contribution,
  ContributionReceipt,
  Cycle,
  Membership,
  Payout,
  PayoutReceipt,
  SwapRequest,
  User,
} from '../entities';
import { AuthModule } from '../auth/auth.module';
import { CirclesController } from './circles.controller';
import { InviteController } from './invite.controller';
import { CirclesService } from './circles.service';
import { MembersService } from './members.service';
import { ContributionsService } from './contributions.service';
import { PayoutsService } from './payouts.service';
import { SwapsService } from './swaps.service';
import { ReceiptStorageService } from './receipt-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Circle,
      Membership,
      Cycle,
      Contribution,
      ContributionReceipt,
      Payout,
      PayoutReceipt,
      SwapRequest,
      User,
    ]),
    AuthModule,
  ],
  controllers: [CirclesController, InviteController],
  providers: [
    CirclesService,
    MembersService,
    ContributionsService,
    PayoutsService,
    SwapsService,
    ReceiptStorageService,
  ],
  // Shared with the member module — same domain, member-scoped access.
  exports: [CirclesService, SwapsService, ReceiptStorageService],
})
export class CirclesModule {}
