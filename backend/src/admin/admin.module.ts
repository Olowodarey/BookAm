import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Circle,
  CollectorApplication,
  Subscription,
  SubscriptionPlan,
  User,
} from '../entities';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { AdminController } from './admin.controller';
import { OverviewService } from './overview.service';
import { ApplicationsService } from './applications.service';
import { PlansService } from './plans.service';
import { SubscriptionsService } from './subscriptions.service';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Circle,
      CollectorApplication,
      Subscription,
      SubscriptionPlan,
    ]),
    AuthModule,
    SettingsModule,
  ],
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
