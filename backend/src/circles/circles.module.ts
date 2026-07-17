import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CirclesController } from './circles.controller';
import { InviteController } from './invite.controller';
import { CirclesService } from './circles.service';
import { MembersService } from './members.service';
import { ContributionsService } from './contributions.service';
import { PayoutsService } from './payouts.service';
import { AppealsService } from './appeals.service';
import { ReceiptStorageService } from './receipt-storage.service';

@Module({
  imports: [AuthModule],
  controllers: [CirclesController, InviteController],
  providers: [
    CirclesService,
    MembersService,
    ContributionsService,
    PayoutsService,
    AppealsService,
    ReceiptStorageService,
  ],
  // Shared with the member module — same domain, member-scoped access.
  exports: [CirclesService, AppealsService, ReceiptStorageService],
})
export class CirclesModule {}
