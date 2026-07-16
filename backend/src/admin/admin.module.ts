import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { OverviewService } from './overview.service';
import { ApplicationsService } from './applications.service';
import { PlansService } from './plans.service';
import { SubscriptionsService } from './subscriptions.service';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [
    OverviewService,
    ApplicationsService,
    PlansService,
    SubscriptionsService,
    UsersService,
  ],
})
export class AdminModule {}
